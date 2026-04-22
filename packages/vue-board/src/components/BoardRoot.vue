<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, provide, ref, shallowRef, toRef, useSlots, watch, type Component, type PropType } from 'vue'
import { type BoardSnapshot, type Camera, type BoardEngine, type BoardNode as BoardNodeState, type InteractionState, type NodeId, type Point, type SnapGuide } from '@lupinum/board-core'
import { createBoardEngine } from '@lupinum/board-core'
import { boardEngineKey } from '../context'
import { type BoardGridOptions, type BoardRendererRegistry } from '../grid'
import { useViewportSize } from '../composables/useViewportSize'
import { useResolvedGrid } from '../composables/useResolvedGrid'
import { useLodCulling } from '../composables/useLodCulling'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { usePointerInteraction } from '../composables/usePointerInteraction'
import BoardBoxSelect from './BoardBoxSelect.vue'
import BoardGrid from './BoardGrid.vue'
import BoardNode from './BoardNode.vue'
import BoardSnapGuides from './BoardSnapGuides.vue'
import BoardViewport from './BoardViewport.vue'

const props = defineProps({
  engine: {
    type: Object as PropType<BoardEngine | undefined>,
    default: undefined
  },
  cullMargin: {
    type: Number,
    default: 200
  },
  grid: {
    type: [Boolean, Object] as PropType<boolean | BoardGridOptions>,
    default: true
  },
  renderers: {
    type: Object as PropType<BoardRendererRegistry>,
    default: () => ({})
  },
  fallbackRenderer: {
    type: Object as PropType<Component | null>,
    default: null
  }
})

const emit = defineEmits<{
  ready: [engine: BoardEngine]
}>()

const rootElement = ref<HTMLElement | null>(null)
const engine = props.engine ?? createBoardEngine()
const snapshot = shallowRef<BoardSnapshot>(engine.getSnapshot())
const renderersRef = shallowRef<BoardRendererRegistry>(props.renderers)

const $camera = shallowRef<Camera>(engine.$camera.get())
const $nodes = shallowRef<ReadonlyMap<NodeId, BoardNodeState>>(engine.$nodes.get())
const $selection = shallowRef<ReadonlySet<NodeId>>(engine.$selection.get())
const $interaction = shallowRef<InteractionState>(engine.$interaction.get())
const $snapGuides = shallowRef<readonly SnapGuide[]>(engine.$snapGuides.get())
const slots = useSlots()
const spacePressed = ref(false)

const { viewportSize } = useViewportSize({ rootElement, engine })

const resolvedGrid = useResolvedGrid({
  engine,
  snapshot,
  gridProp: toRef(props, 'grid')
})

provide(boardEngineKey, {
  engine,
  snapshot,
  rootElement,
  viewportSize,
  renderers: renderersRef,
  resolvedGrid,
  toLocalPoint,
  $camera,
  $nodes,
  $selection,
  $interaction,
  $snapGuides,
})

let prevSelectionIds: NodeId[] = []
let prevSelectionSet = new Set<NodeId>()
const selectionSet = computed(() => {
  const ids = Array.from($selection.value)
  if (ids.length === prevSelectionIds.length && ids.every((id, i) => id === prevSelectionIds[i])) {
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
  cullMargin: toRef(props, 'cullMargin')
})

const debugState = computed(() => ({
  snapshot: snapshot.value,
  camera: $camera.value,
  grid: snapshot.value.grid,
  selection: Array.from($selection.value),
  interaction: $interaction.value,
  visibleNodeCount: visibleNodes.value.length,
  trace: engine.exportTrace().slice(-20)
}))

let snapshotDirty = false
function scheduleSnapshotRefresh(): void {
  if (!snapshotDirty) {
    snapshotDirty = true
    queueMicrotask(() => {
      snapshot.value = engine.getSnapshot()
      snapshotDirty = false
    })
  }
}

const unsubscribes = [
  engine.on('command:after', scheduleSnapshotRefresh),
  engine.$camera.subscribe((v) => { $camera.value = v }),
  engine.$nodes.subscribe((v) => { $nodes.value = v }),
  engine.$selection.subscribe((v) => { $selection.value = v }),
  engine.$interaction.subscribe((v) => { $interaction.value = v }),
  engine.$snapGuides.subscribe((v) => { $snapGuides.value = v }),
]

watch(
  () => props.renderers,
  (value) => {
    renderersRef.value = Object.fromEntries(
      Object.entries(value).map(([key, component]) => [key, markRaw(component)])
    )
  },
  { immediate: true, deep: true }
)

function toLocalPoint(clientX: number, clientY: number): Point {
  const rect = rootElement.value?.getBoundingClientRect()
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0)
  }
}

const { onPointerDown, onPointerMove, onPointerUp, onWheel, onDoubleClick } = usePointerInteraction({
  engine,
  rootElement,
  spacePressed,
  toLocalPoint
})

const { onKeyDown, onKeyUp } = useKeyboardShortcuts({
  engine,
  snapshot,
  spacePressed
})

function resolveRenderer(node: BoardNodeState): Component | null {
  return renderersRef.value[node.type] ?? props.fallbackRenderer
}

function hasCustomContentForNode(node: BoardNodeState): boolean {
  return Boolean(resolveRenderer(node)) ||
    Boolean(slots[`node:${node.type}`]) ||
    Boolean(slots['node'])
}

onMounted(() => {
  emit('ready', engine)
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
})
</script>

<template>
  <div
    ref="rootElement"
    class="board-root"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
  >
    <BoardGrid />
    <BoardViewport>
      <slot name="viewport" :engine="engine" :snapshot="snapshot" />
      <template v-for="node in visibleNodes" :key="node.id">
        <BoardNode
          v-if="node.lod === 'full'"
          v-memo="[node.x, node.y, node.width, node.height, node.zIndex, node.lod, selectionSet.has(node.id), snapshot.interaction.mode === 'editing-text' && snapshot.interaction.nodeId === node.id]"
          :node="node"
          :selected="selectionSet.has(node.id)"
          :editing="snapshot.interaction.mode === 'editing-text' && snapshot.interaction.nodeId === node.id"
          :custom-renderer="hasCustomContentForNode(node)"
        >
          <template #default="slotProps">
            <slot :name="`node:${node.type}`" v-bind="slotProps">
              <slot name="node" v-bind="slotProps">
                <component v-if="resolveRenderer(node)" :is="resolveRenderer(node)" v-bind="slotProps" />
              </slot>
            </slot>
          </template>
          <template #handle="slotProps">
            <slot name="handle" v-bind="slotProps" />
          </template>
        </BoardNode>
        <div
          v-else
          v-memo="[node.x, node.y, node.width, node.height, node.zIndex, node.lod]"
          class="board-node-simple"
          :data-node-id="node.id"
          :style="{ left: node.x + 'px', top: node.y + 'px', width: node.width + 'px', height: node.height + 'px', zIndex: node.zIndex }"
        />
      </template>
    </BoardViewport>
    <BoardSnapGuides />
    <BoardBoxSelect>
      <template #default="slotProps">
        <slot name="box-select" v-bind="slotProps" />
      </template>
    </BoardBoxSelect>
    <slot :engine="engine" :snapshot="snapshot" :debug-state="debugState" />
  </div>
</template>

<style scoped>
.board-root {
  --board-bg: var(--ui-bg, #f8fbfd);
  --board-fg: var(--ui-text-highlighted, #0f172a);
  --board-node-bg: var(--ui-bg, rgba(255, 255, 255, 0.96));
  --board-node-border: var(--ui-border, rgba(148, 163, 184, 0.28));
  --board-node-border-hover: var(--ui-border-hover, rgba(100, 116, 139, 0.42));
  --board-node-stripe: var(--ui-bg-accented, rgba(15, 23, 42, 0.06));
  --board-node-ring: color-mix(in srgb, var(--ui-primary, #0f766e) 45%, transparent);
  --board-node-radius: 8px;
  --board-node-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --board-node-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --board-node-shadow-selected: 0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06);
  --board-group-bg: var(--ui-bg-elevated, rgba(15, 23, 42, 0.04));
  --board-group-border: var(--ui-border, rgba(15, 23, 42, 0.12));
  --board-accent: var(--ui-primary, #0f766e);
  --board-edge-color: var(--ui-text-dimmed, rgba(71, 85, 105, 0.82));
  --board-edge-active-color: var(--ui-primary, #0f766e);
  --board-handle-shadow: rgba(0, 0, 0, 0.1);
  --board-box-select-fill: color-mix(in srgb, var(--ui-primary, #0f766e) 10%, transparent);
  --board-box-select-stroke: color-mix(in srgb, var(--ui-primary, #0f766e) 60%, transparent);
  --board-snap-guide-color: var(--ui-primary, rgba(15, 118, 110, 0.95));
  --board-grid-minor-rgb: 148 163 184;
  --board-grid-major-rgb: 100 116 139;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: var(--board-bg);
  color: var(--board-fg);
  isolation: isolate;
}

.board-node-simple {
  position: absolute;
  box-sizing: border-box;
  border: calc(1px / var(--board-zoom, 1)) solid var(--board-node-border);
  background: var(--board-node-bg);
  border-radius: calc(var(--board-node-radius, 8px) / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow);
  overflow: hidden;
  contain: layout style paint;
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
    var(--board-node-stripe) 0px,
    var(--board-node-stripe) 2px,
    transparent 2px,
    transparent 6px
  );
}

:global(.dark) .board-root {
  --board-bg: var(--ui-bg, #111827);
  --board-fg: var(--ui-text-highlighted, #e5eef6);
  --board-node-bg: var(--ui-bg-elevated, rgba(15, 23, 42, 0.92));
  --board-node-border: var(--ui-border, rgba(148, 163, 184, 0.18));
  --board-node-border-hover: var(--ui-border-hover, rgba(148, 163, 184, 0.3));
  --board-node-stripe: var(--ui-bg-accented, rgba(226, 232, 240, 0.08));
  --board-node-ring: color-mix(in srgb, var(--ui-primary, #2dd4bf) 50%, transparent);
  --board-node-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.15);
  --board-node-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
  --board-node-shadow-selected: 0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25);
  --board-group-bg: var(--ui-bg-elevated, rgba(148, 163, 184, 0.06));
  --board-group-border: var(--ui-border, rgba(148, 163, 184, 0.22));
  --board-accent: var(--ui-primary, #2dd4bf);
  --board-edge-color: var(--ui-text-dimmed, rgba(148, 163, 184, 0.74));
  --board-edge-active-color: var(--ui-primary, #2dd4bf);
  --board-handle-shadow: rgba(0, 0, 0, 0.3);
  --board-box-select-fill: color-mix(in srgb, var(--ui-primary, #2dd4bf) 12%, transparent);
  --board-box-select-stroke: color-mix(in srgb, var(--ui-primary, #2dd4bf) 70%, transparent);
  --board-snap-guide-color: var(--ui-primary, rgba(45, 212, 191, 0.98));
  --board-grid-minor-rgb: 71 85 105;
  --board-grid-major-rgb: 148 163 184;
}
</style>
