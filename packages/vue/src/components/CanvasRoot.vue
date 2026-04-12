<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, provide, ref, shallowRef, useSlots, watch, type Component, type PropType } from 'vue'
import type { BoardSnapshot, CanvasEngine, CanvasNode as CanvasNodeState, GridSettings, Point, ResizeHandle } from '@canvas/core'
import { createCanvasEngine } from '@canvas/core'
import { canvasEngineKey } from '../context'
import { DEFAULT_CANVAS_GRID_OPTIONS, type CanvasGridOptions, type CanvasRendererRegistry, type ResolvedCanvasGridOptions } from '../grid'
import CanvasBoxSelect from './CanvasBoxSelect.vue'
import CanvasGrid from './CanvasGrid.vue'
import CanvasNode from './CanvasNode.vue'
import CanvasSnapGuides from './CanvasSnapGuides.vue'
import CanvasViewport from './CanvasViewport.vue'

const props = defineProps({
  engine: {
    type: Object as PropType<CanvasEngine | undefined>,
    default: undefined
  },
  cullMargin: {
    type: Number,
    default: 200
  },
  grid: {
    type: [Boolean, Object] as PropType<boolean | CanvasGridOptions>,
    default: true
  },
  renderers: {
    type: Object as PropType<CanvasRendererRegistry>,
    default: () => ({})
  },
  fallbackRenderer: {
    type: Object as PropType<Component | null>,
    default: null
  }
})

const emit = defineEmits<{
  ready: [engine: CanvasEngine]
}>()

const rootElement = ref<HTMLElement | null>(null)
const viewportSize = ref<Point>({ x: 0, y: 0 })
const engine = props.engine ?? createCanvasEngine()
const snapshot = shallowRef<BoardSnapshot>(engine.getSnapshot())
const renderersRef = shallowRef<CanvasRendererRegistry>(props.renderers)
const slots = useSlots()
const spacePressed = ref(false)

function resolveGridOptions(
  input: boolean | CanvasGridOptions,
  engineGrid: GridSettings
): ResolvedCanvasGridOptions {
  if (input === false) {
    return {
      ...DEFAULT_CANVAS_GRID_OPTIONS,
      visible: false,
      size: engineGrid.size,
      majorEvery: engineGrid.majorEvery,
      snap: engineGrid.snap,
      pattern: engineGrid.pattern
    }
  }

  const overrides = input === true ? {} : input

  return {
    visible: overrides.visible ?? DEFAULT_CANVAS_GRID_OPTIONS.visible,
    size: overrides.size ?? engineGrid.size,
    majorEvery: overrides.majorEvery ?? engineGrid.majorEvery,
    snap: overrides.snap ?? engineGrid.snap,
    pattern: overrides.pattern ?? engineGrid.pattern,
    minorOpacity: overrides.minorOpacity ?? DEFAULT_CANVAS_GRID_OPTIONS.minorOpacity,
    majorOpacity: overrides.majorOpacity ?? DEFAULT_CANVAS_GRID_OPTIONS.majorOpacity,
    fadeEdges: overrides.fadeEdges ?? DEFAULT_CANVAS_GRID_OPTIONS.fadeEdges
  }
}

const resolvedGrid = computed(() => resolveGridOptions(props.grid, snapshot.value.grid))

provide(canvasEngineKey, {
  engine,
  snapshot,
  rootElement,
  viewportSize,
  renderers: renderersRef,
  resolvedGrid,
  toLocalPoint
})

let prevSelectionIds: string[] = []
let prevSelectionSet = new Set<string>()
const selectionSet = computed(() => {
  const ids = snapshot.value.selection
  if (ids.length === prevSelectionIds.length && ids.every((id, i) => id === prevSelectionIds[i])) {
    return prevSelectionSet
  }
  prevSelectionIds = ids
  prevSelectionSet = new Set(ids)
  return prevSelectionSet
})

type NodeLod = 'full' | 'simple' | 'hidden'
type LodNode = CanvasNodeState & { lod: NodeLod }

function getNodeLod(node: CanvasNodeState, zoom: number, selected: boolean): NodeLod {
  if (selected) {
    return 'full'
  }
  const screenSize = Math.max(node.width, node.height) * zoom
  if (screenSize < 8) {
    return 'hidden'
  }
  if (screenSize < 60) {
    return 'simple'
  }
  return 'full'
}

const visibleNodes = computed<LodNode[]>(() => {
  const bounds = engine.getVisibleBounds(viewportSize.value.x, viewportSize.value.y)
  const zoom = snapshot.value.camera.z
  const sel = selectionSet.value
  const result: LodNode[] = []
  for (const node of snapshot.value.nodes) {
    if (!node.visible) {
      continue
    }
    if (
      node.x + node.width <= bounds.minX - props.cullMargin ||
      node.x >= bounds.maxX + props.cullMargin ||
      node.y + node.height <= bounds.minY - props.cullMargin ||
      node.y >= bounds.maxY + props.cullMargin
    ) {
      continue
    }
    const lod = getNodeLod(node, zoom, sel.has(node.id))
    if (lod !== 'hidden') {
      result.push({ ...node, lod })
    }
  }
  return result
})

const debugState = computed(() => ({
  snapshot: snapshot.value,
  camera: snapshot.value.camera,
  grid: snapshot.value.grid,
  selection: snapshot.value.selection,
  interaction: snapshot.value.interaction,
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
  engine.on('command:after', scheduleSnapshotRefresh)
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

watch(
  () => props.grid,
  (value) => {
    if (value && typeof value === 'object') {
      const patch: Partial<GridSettings> = {}
      if (value.size !== undefined) {
        patch.size = value.size
      }
      if (value.majorEvery !== undefined) {
        patch.majorEvery = value.majorEvery
      }
      if (value.snap !== undefined) {
        patch.snap = value.snap
      }
      if (value.pattern !== undefined) {
        patch.pattern = value.pattern
      }
      if (Object.keys(patch).length > 0) {
        engine.updateGridSettings(patch)
      }
    }
  },
  { immediate: true, deep: true }
)

function updateViewportSize(): void {
  const rect = rootElement.value?.getBoundingClientRect()
  viewportSize.value = {
    x: rect?.width ?? 0,
    y: rect?.height ?? 0
  }
  engine.setViewportSize(viewportSize.value)
}

function toLocalPoint(clientX: number, clientY: number): Point {
  const rect = rootElement.value?.getBoundingClientRect()
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0)
  }
}

function findNodeId(target: EventTarget | null): string | undefined {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId : undefined
}

function findHandle(target: EventTarget | null): ResizeHandle | undefined {
  return target instanceof HTMLElement ? (target.closest<HTMLElement>('[data-resize]')?.dataset.resize as ResizeHandle | undefined) : undefined
}

function isEditorTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-editor="true"]'))
}

function startPointerInteraction(event: PointerEvent, kind: 'pan' | 'drag' | 'resize' | 'box-select', nodeId?: string, handle?: ResizeHandle): void {
  const point = toLocalPoint(event.clientX, event.clientY)
  if (kind === 'pan') {
    engine.beginPan(event.pointerId, point)
  } else if (kind === 'drag' && nodeId) {
    engine.beginNodeDrag(nodeId, event.pointerId, point)
  } else if (kind === 'resize' && nodeId && handle) {
    engine.beginResize(nodeId, handle, event.pointerId, point)
  } else {
    engine.beginBoxSelect(event.pointerId, point)
  }
  rootElement.value?.setPointerCapture(event.pointerId)
  rootElement.value?.focus()
}

function onPointerDown(event: PointerEvent): void {
  if (isEditorTarget(event.target)) {
    return
  }
  if (event.button === 1 || spacePressed.value) {
    event.preventDefault()
    startPointerInteraction(event, 'pan')
    return
  }
  if (event.button !== 0) {
    return
  }

  const nodeId = findNodeId(event.target)
  const handle = findHandle(event.target)
  if (handle && nodeId) {
    startPointerInteraction(event, 'resize', nodeId, handle)
    return
  }
  if (nodeId) {
    startPointerInteraction(event, 'drag', nodeId)
    return
  }
  startPointerInteraction(event, 'box-select')
}

let pendingPointer: { id: number; point: Point; shift: boolean } | null = null
let rafScheduled = false

function onPointerMove(event: PointerEvent): void {
  pendingPointer = { id: event.pointerId, point: toLocalPoint(event.clientX, event.clientY), shift: event.shiftKey }
  if (!rafScheduled) {
    rafScheduled = true
    requestAnimationFrame(() => {
      if (pendingPointer) {
        engine.updatePointer(pendingPointer.id, pendingPointer.point, { shift: pendingPointer.shift })
      }
      rafScheduled = false
      pendingPointer = null
    })
  }
}

function flushPendingPointer(): void {
  if (pendingPointer) {
    engine.updatePointer(pendingPointer.id, pendingPointer.point, { shift: pendingPointer.shift })
    pendingPointer = null
    rafScheduled = false
  }
}

function onPointerUp(event: PointerEvent): void {
  flushPendingPointer()
  engine.endInteraction(event.pointerId)
  if (rootElement.value?.hasPointerCapture(event.pointerId)) {
    rootElement.value.releasePointerCapture(event.pointerId)
  }
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const point = toLocalPoint(event.clientX, event.clientY)
  if (event.ctrlKey || event.metaKey) {
    engine.zoomAt(point, Math.max(-10, Math.min(10, event.deltaY)))
  } else {
    engine.panBy(event.deltaX, event.deltaY)
  }
}

function onDoubleClick(event: MouseEvent): void {
  if (isEditorTarget(event.target) || findHandle(event.target)) {
    return
  }
  const nodeId = findNodeId(event.target)
  if (nodeId) {
    engine.beginTextEdit(nodeId)
    return
  }
  const point = toLocalPoint(event.clientX, event.clientY)
  const world = engine.screenToWorld(point)
  const node = engine.createNode({
    type: 'text',
    x: world.x,
    y: world.y,
    data: { content: 'New node' }
  })
  engine.beginTextEdit(node.id)
}

function shouldIgnoreHotkeys(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Space' && !shouldIgnoreHotkeys(event)) {
    event.preventDefault()
    spacePressed.value = true
  }
  if (shouldIgnoreHotkeys(event)) {
    return
  }

  const mod = event.metaKey || event.ctrlKey
  const selection = engine.getSelection()
  if (event.key === 'Escape') {
    engine.clearSelection()
    engine.endInteraction()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selection.length > 0) {
      event.preventDefault()
      engine.deleteSelected()
    }
    return
  }
  if (event.key === 'Enter' && selection.length === 1) {
    engine.beginTextEdit(selection[0]!)
    return
  }
  if (mod && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    engine.selectAll()
    return
  }
  if (mod && event.key.toLowerCase() === 'd' && selection.length > 0) {
    event.preventDefault()
    engine.duplicateNodes(selection)
    return
  }
  if (mod && event.key.toLowerCase() === 'c' && selection.length > 0) {
    event.preventDefault()
    engine.copySelected()
    return
  }
  if (mod && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    engine.pasteClipboard()
    return
  }
  if (mod && event.key === '0') {
    event.preventDefault()
    void engine.zoomTo(1, true)
    return
  }
  if (mod && event.key === '1') {
    event.preventDefault()
    void engine.zoomToFit(40, true)
    return
  }
  if (mod && event.key.toLowerCase() === 'z') {
    const target = event.shiftKey ? (engine as CanvasEngine & { redo?: () => void }).redo : (engine as CanvasEngine & { undo?: () => void }).undo
    if (target) {
      event.preventDefault()
      target.call(engine)
    }
    return
  }
  if (mod && event.key.toLowerCase() === 'y') {
    const redo = (engine as CanvasEngine & { redo?: () => void }).redo
    if (redo) {
      event.preventDefault()
      redo.call(engine)
    }
    return
  }
  if (selection.length > 0 && event.key.startsWith('Arrow')) {
    event.preventDefault()
    const step = event.shiftKey ? snapshot.value.grid.size * snapshot.value.grid.majorEvery : snapshot.value.grid.size
    const delta =
      event.key === 'ArrowLeft'
        ? { x: -step, y: 0 }
        : event.key === 'ArrowRight'
          ? { x: step, y: 0 }
          : event.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : { x: 0, y: step }
    engine.translateSelectedNodes(delta.x, delta.y)
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    spacePressed.value = false
  }
}

function resolveRenderer(node: CanvasNodeState): Component | null {
  return renderersRef.value[node.type] ?? props.fallbackRenderer
}

function hasCustomContentForNode(node: CanvasNodeState): boolean {
  return Boolean(resolveRenderer(node)) ||
    Boolean(slots[`node:${node.type}`]) ||
    Boolean(slots['node'])
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateViewportSize()
  if (rootElement.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateViewportSize)
    resizeObserver.observe(rootElement.value)
  } else {
    window.addEventListener('resize', updateViewportSize)
  }
  emit('ready', engine)
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  } else {
    window.removeEventListener('resize', updateViewportSize)
  }
})
</script>

<template>
  <div
    ref="rootElement"
    class="canvas-root"
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
    <CanvasGrid />
    <CanvasViewport>
      <slot name="viewport" :engine="engine" :snapshot="snapshot" />
      <template v-for="node in visibleNodes" :key="node.id">
        <CanvasNode
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
        </CanvasNode>
        <div
          v-else
          v-memo="[node.x, node.y, node.width, node.height, node.zIndex, node.lod]"
          class="canvas-node-simple"
          :data-node-id="node.id"
          :style="{ left: node.x + 'px', top: node.y + 'px', width: node.width + 'px', height: node.height + 'px', zIndex: node.zIndex }"
        />
      </template>
    </CanvasViewport>
    <CanvasSnapGuides />
    <CanvasBoxSelect>
      <template #default="slotProps">
        <slot name="box-select" v-bind="slotProps" />
      </template>
    </CanvasBoxSelect>
    <slot :engine="engine" :snapshot="snapshot" :debug-state="debugState" />
  </div>
</template>

<style scoped>
.canvas-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: #fff;
  color: #0f172a;
}

.canvas-node-simple {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(15, 23, 42, 0.15);
  background: #fff;
  contain: strict;
}
</style>
