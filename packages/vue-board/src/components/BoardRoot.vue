<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRef,
  useSlots,
  watch,
  type Component,
  type PropType,
} from 'vue'
import {
  type BoardState,
  type Camera,
  type BoardEngine,
  type GridSettings,
  type BoardNode as BoardNodeState,
  type InteractionState,
  type NodeId,
  type Point,
  type SnapGuide,
} from '@lupinum/board-core'
import { createBoardEngine } from '@lupinum/board-core'
import { boardEngineKey } from '../context.js'
import { type BoardGridOptions, type BoardRendererRegistry } from '../grid.js'
import { useViewportSize } from '../composables/useViewportSize.js'
import { useResolvedGrid } from '../composables/useResolvedGrid.js'
import { useLodCulling } from '../composables/useLodCulling.js'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts.js'
import { usePointerInteraction } from '../composables/usePointerInteraction.js'
import BoardBoxSelect from './BoardBoxSelect.vue'
import BoardGrid from './BoardGrid.vue'
import BoardNode from './BoardNode.vue'
import BoardSnapGuides from './BoardSnapGuides.vue'
import BoardViewport from './BoardViewport.vue'
import BoardSelectionToolbar from './BoardSelectionToolbar.vue'
import { resolveNodeColorStyle } from '../nodeColors.js'

const props = defineProps({
  engine: {
    type: Object as PropType<BoardEngine | undefined>,
    default: undefined,
  },
  cullMargin: {
    type: Number,
    default: 200,
  },
  grid: {
    type: [Boolean, Object] as PropType<boolean | BoardGridOptions>,
    default: true,
  },
  selectionToolbar: {
    type: Boolean,
    default: true,
  },
  snapGuides: {
    type: Boolean,
    default: true,
  },
  boxSelect: {
    type: Boolean,
    default: true,
  },
  renderers: {
    type: Object as PropType<BoardRendererRegistry>,
    default: () => ({}),
  },
  fallbackRenderer: {
    type: Object as PropType<Component | null>,
    default: null,
  },
})

const emit = defineEmits<{
  ready: [engine: BoardEngine]
}>()

const rootElement = ref<HTMLElement | null>(null)
const engine = props.engine ?? createBoardEngine()
const ownsEngine = props.engine === undefined
const renderersRef = shallowRef<BoardRendererRegistry>(props.renderers)

const $camera = shallowRef<Camera>(engine.$camera.get())
const $grid = shallowRef<GridSettings>(engine.$grid.get())
const $nodes = shallowRef<ReadonlyMap<NodeId, BoardNodeState>>(
  engine.$nodes.get(),
)
const $selection = shallowRef<ReadonlySet<NodeId>>(engine.$selection.get())
const $interaction = shallowRef<InteractionState>(engine.$interaction.get())
const $snapGuides = shallowRef<readonly SnapGuide[]>(engine.$snapGuides.get())
const slots = useSlots()
const spacePressed = ref(false)

const { viewportSize } = useViewportSize({ rootElement, engine })

const resolvedGrid = useResolvedGrid({
  grid: $grid,
  gridProp: toRef(props, 'grid'),
})

provide(boardEngineKey, {
  engine,
  rootElement,
  viewportSize,
  renderers: renderersRef,
  resolvedGrid,
  toLocalPoint,
  $camera,
  $grid,
  $nodes,
  $selection,
  $interaction,
  $snapGuides,
})

let prevSelectionIds: NodeId[] = []
let prevSelectionSet = new Set<NodeId>()
const selectionSet = computed(() => {
  const ids = Array.from($selection.value)
  if (
    ids.length === prevSelectionIds.length &&
    ids.every((id, i) => id === prevSelectionIds[i])
  ) {
    return prevSelectionSet
  }
  prevSelectionIds = ids
  prevSelectionSet = new Set(ids)
  return prevSelectionSet
})

const visibleNodes = useLodCulling({
  engine,
  nodes: $nodes,
  camera: $camera,
  selectionSet,
  viewportSize,
  cullMargin: toRef(props, 'cullMargin'),
})

const state = computed<BoardState>(() => {
  return {
    camera: $camera.value,
    grid: $grid.value,
    nodes: $nodes.value,
    selection: $selection.value,
    interaction: $interaction.value,
    snapGuides: $snapGuides.value,
  }
})

const debugState = computed(() => ({
  state: state.value,
  camera: $camera.value,
  grid: $grid.value,
  selection: Array.from($selection.value),
  interaction: $interaction.value,
  visibleNodeCount: visibleNodes.value.length,
  trace: engine.exportTrace().slice(-20),
}))

const unsubscribes = [
  engine.$camera.subscribe((v) => {
    $camera.value = v
  }),
  engine.$grid.subscribe((v) => {
    $grid.value = v
  }),
  engine.$nodes.subscribe((v) => {
    $nodes.value = v
  }),
  engine.$selection.subscribe((v) => {
    $selection.value = v
  }),
  engine.$interaction.subscribe((v) => {
    $interaction.value = v
  }),
  engine.$snapGuides.subscribe((v) => {
    $snapGuides.value = v
  }),
]

watch(
  () => props.renderers,
  (value) => {
    renderersRef.value = Object.fromEntries(
      Object.entries(value).map(([key, component]) => [
        key,
        markRaw(component),
      ]),
    )
  },
  { immediate: true, deep: true },
)

function toLocalPoint(clientX: number, clientY: number): Point {
  const rect = rootElement.value?.getBoundingClientRect()
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0),
  }
}

const {
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onDoubleClick,
} = usePointerInteraction({
  engine,
  rootElement,
  spacePressed,
  toLocalPoint,
})

const { onKeyDown, onKeyUp } = useKeyboardShortcuts({
  engine,
  grid: $grid,
  rootElement,
  spacePressed,
})

function resolveRenderer(node: BoardNodeState): Component | null {
  return renderersRef.value[node.type] ?? props.fallbackRenderer
}

function hasCustomContentForNode(node: BoardNodeState): boolean {
  return (
    Boolean(resolveRenderer(node)) ||
    Boolean(slots[`node:${node.type}`]) ||
    Boolean(slots['node'])
  )
}

onMounted(() => {
  emit('ready', engine)
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
  if (ownsEngine) {
    engine.destroy()
  }
})
</script>

<template>
  <div
    ref="rootElement"
    class="board-root"
    data-board-root="true"
    tabindex="0"
    role="application"
    aria-label="Board canvas"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
  >
    <BoardGrid v-if="grid !== false" />
    <BoardViewport>
      <slot name="viewport" :engine="engine" :state="state" />
      <template v-for="node in visibleNodes" :key="node.id">
        <BoardNode
          v-if="node.lod === 'full'"
          :node="node"
          :selected="selectionSet.has(node.id)"
          :editing="
            $interaction.mode === 'editing-text' &&
            $interaction.nodeId === node.id
          "
          :custom-renderer="hasCustomContentForNode(node)"
        >
          <template #default="slotProps">
            <slot :name="`node:${node.type}`" v-bind="slotProps">
              <slot name="node" v-bind="slotProps">
                <component
                  v-if="resolveRenderer(node)"
                  :is="resolveRenderer(node)"
                  v-bind="slotProps"
                />
              </slot>
            </slot>
          </template>
          <template #handle="slotProps">
            <slot name="handle" v-bind="slotProps" />
          </template>
        </BoardNode>
        <div
          v-else
          class="board-node-simple"
          :class="{
            'is-colored': Boolean(node.color),
            'is-group': node.type === 'group',
          }"
          :data-node-id="node.id"
          :style="{
            left: node.x + 'px',
            top: node.y + 'px',
            width: node.width + 'px',
            height: node.height + 'px',
            zIndex: node.zIndex,
            ...resolveNodeColorStyle(node.color),
          }"
        />
      </template>
    </BoardViewport>
    <BoardSelectionToolbar v-if="selectionToolbar" />
    <BoardSnapGuides v-if="snapGuides" />
    <BoardBoxSelect v-if="boxSelect">
      <template #default="slotProps">
        <slot name="box-select" v-bind="slotProps" />
      </template>
    </BoardBoxSelect>
    <slot :engine="engine" :state="state" :debug-state="debugState" />
  </div>
</template>

<style scoped>
.board-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: var(--board-canvas-bg, var(--board-bg, #f5f6fa));
  color: var(--board-fg, #14161f);
  isolation: isolate;
  transition:
    background-color var(--board-dur-slow, 260ms) var(--board-ease-out, ease),
    color var(--board-dur-slow, 260ms) var(--board-ease-out, ease);
}

.board-node-simple {
  position: absolute;
  box-sizing: border-box;
  border: calc(1px / var(--board-zoom, 1)) solid
    var(--board-node-border, rgba(148, 163, 184, 0.28));
  background: var(--board-node-bg, #fff);
  border-radius: calc(var(--board-node-radius, 10px) / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow, 0 0.5px 1px 0.5px rgba(9, 14, 28, 0.08));
  overflow: hidden;
  contain: layout style paint;
}

.board-node-simple.is-colored {
  border-color: var(--board-node-color);
  background: var(--board-node-tint);
}

.board-node-simple.is-group {
  border-style: dashed;
  border-radius: calc(var(--board-group-radius, 16px) / var(--board-zoom, 1));
}

.board-node-simple::after {
  content: '';
  position: absolute;
  top: 25%;
  left: 20%;
  right: 20%;
  height: 50%;
  background: repeating-linear-gradient(
    to bottom,
    var(--board-divider, rgba(15, 23, 42, 0.06)) 0px,
    var(--board-divider, rgba(15, 23, 42, 0.06)) 2px,
    transparent 2px,
    transparent 6px
  );
}

@media (prefers-reduced-motion: reduce) {
  .board-root {
    transition: none;
  }
}
</style>
