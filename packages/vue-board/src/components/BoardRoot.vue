<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, provide, ref, shallowRef, useSlots, watch, type Component, type PropType } from 'vue'
import { asNodeId, type BoardSnapshot, type Camera, type BoardEngine, type BoardNode as BoardNodeState, type GridSettings, type InteractionState, type NodeId, type Point, type ResizeHandle, type SnapGuide } from '@lupinum/board-core'
import { createBoardEngine } from '@lupinum/board-core'
import { boardEngineKey } from '../context'
import { DEFAULT_BOARD_GRID_OPTIONS, type BoardGridOptions, type BoardRendererRegistry, type ResolvedBoardGridOptions } from '../grid'
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
const viewportSize = ref<Point>({ x: 0, y: 0 })
const engine = props.engine ?? createBoardEngine()
const snapshot = shallowRef<BoardSnapshot>(engine.getSnapshot())
const renderersRef = shallowRef<BoardRendererRegistry>(props.renderers)

// Granular reactive refs backed by engine subscribables
const $camera = shallowRef<Camera>(engine.$camera.get())
const $nodes = shallowRef<ReadonlyMap<NodeId, BoardNodeState>>(engine.$nodes.get())
const $selection = shallowRef<ReadonlySet<NodeId>>(engine.$selection.get())
const $interaction = shallowRef<InteractionState>(engine.$interaction.get())
const $snapGuides = shallowRef<readonly SnapGuide[]>(engine.$snapGuides.get())
const slots = useSlots()
const spacePressed = ref(false)

function resolveGridOptions(
  input: boolean | BoardGridOptions,
  engineGrid: GridSettings
): ResolvedBoardGridOptions {
  if (input === false) {
    return {
      ...DEFAULT_BOARD_GRID_OPTIONS,
      visible: false,
      size: engineGrid.size,
      majorEvery: engineGrid.majorEvery,
      snap: engineGrid.snap,
      edgeSnap: engineGrid.edgeSnap,
      edgeSnapThreshold: engineGrid.edgeSnapThreshold,
      pattern: engineGrid.pattern
    }
  }

  const overrides = input === true ? {} : input

  return {
    visible: overrides.visible ?? DEFAULT_BOARD_GRID_OPTIONS.visible,
    size: overrides.size ?? engineGrid.size,
    majorEvery: overrides.majorEvery ?? engineGrid.majorEvery,
    snap: overrides.snap ?? engineGrid.snap,
    edgeSnap: overrides.edgeSnap ?? engineGrid.edgeSnap,
    edgeSnapThreshold: overrides.edgeSnapThreshold ?? engineGrid.edgeSnapThreshold,
    pattern: overrides.pattern ?? engineGrid.pattern,
    minorOpacity: overrides.minorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.minorOpacity,
    majorOpacity: overrides.majorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.majorOpacity,
    fadeEdges: overrides.fadeEdges ?? DEFAULT_BOARD_GRID_OPTIONS.fadeEdges
  }
}

const resolvedGrid = computed(() => resolveGridOptions(props.grid, snapshot.value.grid))

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

type NodeLod = 'full' | 'simple' | 'hidden'
type LodNode = BoardNodeState & { lod: NodeLod }

function getNodeLod(node: BoardNodeState, zoom: number, selected: boolean): NodeLod {
  if (selected) {
    return 'full'
  }
  const screenSize = Math.max(node.width, node.height) * zoom
  if (screenSize < 8) {
    return 'hidden'
  }
  if (screenSize < 120) {
    return 'simple'
  }
  return 'full'
}


const visibleNodes = computed<LodNode[]>(() => {
  const canCull = viewportSize.value.x > 0 && viewportSize.value.y > 0
  const bounds = canCull ? engine.getVisibleBounds(viewportSize.value.x, viewportSize.value.y) : null
  const zoom = $camera.value.z
  const sel = selectionSet.value
  const result: LodNode[] = []
  for (const node of $nodes.value.values()) {
    if (!node.visible) {
      continue
    }
    if (bounds && (
      node.x + node.width <= bounds.minX - props.cullMargin ||
      node.x >= bounds.maxX + props.cullMargin ||
      node.y + node.height <= bounds.minY - props.cullMargin ||
      node.y >= bounds.maxY + props.cullMargin
    )) {
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
  camera: $camera.value,
  grid: snapshot.value.grid,
  selection: Array.from($selection.value),
  interaction: $interaction.value,
  visibleNodeCount: visibleNodes.value.length,
  trace: engine.exportTrace().slice(-20)
}))

const POINTER_DRAG_THRESHOLD = 6

type PendingPointerInteraction =
  | {
      kind: 'drag'
      pointerId: number
      startPoint: Point
      nodeId: string
    }
  | {
      kind: 'resize'
      pointerId: number
      startPoint: Point
      nodeId: string
      handle: ResizeHandle
    }
  | {
      kind: 'box-select'
      pointerId: number
      startPoint: Point
    }

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
      if (value.edgeSnap !== undefined) {
        patch.edgeSnap = value.edgeSnap
      }
      if (value.edgeSnapThreshold !== undefined) {
        patch.edgeSnapThreshold = value.edgeSnapThreshold
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

function isBoardInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-board-interactive="true"]'))
}

function findNodeIdAtPoint(screenPoint: Point): string | undefined {
  const world = engine.screenToWorld(screenPoint)
  return engine.getNodeAt(world)?.id
}

function startPointerInteraction(
  pointerId: number,
  point: Point,
  kind: 'pan' | 'drag' | 'resize' | 'box-select',
  nodeId?: string,
  handle?: ResizeHandle
): void {
  if (kind === 'pan') {
    engine.beginPan(pointerId, point)
  } else if (kind === 'drag' && nodeId) {
    engine.beginNodeDrag(asNodeId(nodeId), pointerId, point)
  } else if (kind === 'resize' && nodeId && handle) {
    engine.beginResize(asNodeId(nodeId), handle, pointerId, point)
  } else {
    engine.beginBoxSelect(pointerId, point)
  }
  rootElement.value?.focus()
}

const pendingInteraction = shallowRef<PendingPointerInteraction | null>(null)

function clearPendingInteraction(pointerId?: number): void {
  if (!pendingInteraction.value) {
    return
  }
  if (pointerId !== undefined && pendingInteraction.value.pointerId !== pointerId) {
    return
  }
  pendingInteraction.value = null
}

function exceedsPointerThreshold(startPoint: Point, nextPoint: Point): boolean {
  return Math.hypot(nextPoint.x - startPoint.x, nextPoint.y - startPoint.y) >= POINTER_DRAG_THRESHOLD
}

function beginDeferredInteraction(event: PointerEvent, nodeId?: string, handle?: ResizeHandle): void {
  const point = toLocalPoint(event.clientX, event.clientY)
  rootElement.value?.setPointerCapture(event.pointerId)
  rootElement.value?.focus()

  if (handle && nodeId) {
    engine.select(asNodeId(nodeId))
    pendingInteraction.value = {
      kind: 'resize',
      pointerId: event.pointerId,
      startPoint: point,
      nodeId,
      handle
    }
    return
  }

  if (nodeId) {
    const selection = engine.getSelection()
    if (!selection.includes(asNodeId(nodeId))) {
      engine.select(asNodeId(nodeId))
    }
    pendingInteraction.value = {
      kind: 'drag',
      pointerId: event.pointerId,
      startPoint: point,
      nodeId
    }
    return
  }

  engine.clearSelection()
  pendingInteraction.value = {
    kind: 'box-select',
    pointerId: event.pointerId,
    startPoint: point
  }
}

function startPendingInteraction(event: PointerEvent, point: Point): boolean {
  const pending = pendingInteraction.value
  if (!pending || pending.pointerId !== event.pointerId || !exceedsPointerThreshold(pending.startPoint, point)) {
    return false
  }

  if (pending.kind === 'drag') {
    if (event.altKey) {
      const sourceNode = engine.findNode(asNodeId(pending.nodeId))
      const created = engine.duplicateNodes(engine.getSelection(), { x: 0, y: 0 }) ?? []
      const dragNode =
        (sourceNode &&
          created.find((node) =>
            node.type === sourceNode.type &&
            node.x === sourceNode.x &&
            node.y === sourceNode.y &&
            node.width === sourceNode.width &&
            node.height === sourceNode.height
          )) ??
        created[0]
      if (dragNode) {
        startPointerInteraction(event.pointerId, pending.startPoint, 'drag', String(dragNode.id))
      }
    } else {
      startPointerInteraction(event.pointerId, pending.startPoint, 'drag', pending.nodeId)
    }
  } else if (pending.kind === 'resize') {
    startPointerInteraction(event.pointerId, pending.startPoint, 'resize', pending.nodeId, pending.handle)
  } else {
    startPointerInteraction(event.pointerId, pending.startPoint, 'box-select')
  }

  pendingInteraction.value = null
  return true
}

function onPointerDown(event: PointerEvent): void {
  const localPoint = toLocalPoint(event.clientX, event.clientY)
  activePointers.set(event.pointerId, localPoint)

  // Second finger down (touch only) — switch to pinch-to-zoom mode
  if (activePointers.size === 2 && event.pointerType === 'touch') {
    engine.endInteraction()
    rootElement.value?.setPointerCapture(event.pointerId)
    pinchActive = true
    pinchPrevDistance = getPinchDistance()
    return
  }

  if (isEditorTarget(event.target)) {
    return
  }
  if (isBoardInteractiveTarget(event.target)) {
    return
  }
  if (event.button === 1 || spacePressed.value) {
    event.preventDefault()
    rootElement.value?.setPointerCapture(event.pointerId)
    startPointerInteraction(event.pointerId, localPoint, 'pan')
    return
  }
  if (event.button !== 0) {
    return
  }

  const nodeId = findNodeId(event.target)
  const handle = findHandle(event.target)
  beginDeferredInteraction(event, nodeId, handle)
}

// Multi-pointer tracking for pinch-to-zoom
const activePointers = new Map<number, Point>()
let pinchActive = false
let pinchPrevDistance = 0

function getPinchDistance(): number {
  const pts = [...activePointers.values()]
  const p1 = pts[0]
  const p2 = pts[1]
  if (!p1 || !p2) return 0
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

function getPinchMidpoint(): Point {
  const pts = [...activePointers.values()]
  const p1 = pts[0]
  const p2 = pts[1]
  if (!p1 || !p2) return { x: 0, y: 0 }
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
}

let pendingPointer: { id: number; point: Point; shift: boolean; space: boolean } | null = null
let rafScheduled = false

function onPointerMove(event: PointerEvent): void {
  const localPoint = toLocalPoint(event.clientX, event.clientY)
  activePointers.set(event.pointerId, localPoint)

  if (pinchActive) {
    const newDist = getPinchDistance()
    if (pinchPrevDistance > 0 && newDist > 0) {
      // Convert ratio to the delta scale expected by zoomAt:
      // nextZoom = currentZoom * 2^(-delta * 0.01), so delta = -100 * log2(ratio)
      const ratio = newDist / pinchPrevDistance
      const delta = -100 * Math.log2(ratio)
      engine.zoomAt(getPinchMidpoint(), delta)
    }
    pinchPrevDistance = newDist
    return
  }

  const startedPendingInteraction = startPendingInteraction(event, localPoint)
  if (!startedPendingInteraction && pendingInteraction.value?.pointerId === event.pointerId) {
    return
  }

  pendingPointer = { id: event.pointerId, point: localPoint, shift: event.shiftKey, space: spacePressed.value }
  if (!rafScheduled) {
    rafScheduled = true
    requestAnimationFrame(() => {
      if (pendingPointer) {
        engine.updatePointer(pendingPointer.id, pendingPointer.point, {
          shift: pendingPointer.shift,
          space: pendingPointer.space
        })
      }
      rafScheduled = false
      pendingPointer = null
    })
  }
}

function flushPendingPointer(): void {
  if (pendingPointer) {
    engine.updatePointer(pendingPointer.id, pendingPointer.point, {
      shift: pendingPointer.shift,
      space: pendingPointer.space
    })
    pendingPointer = null
    rafScheduled = false
  }
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)

  if (rootElement.value?.hasPointerCapture(event.pointerId)) {
    rootElement.value.releasePointerCapture(event.pointerId)
  }

  if (pinchActive) {
    if (activePointers.size < 2) {
      pinchActive = false
      pinchPrevDistance = 0
      engine.endInteraction()
    }
    return
  }

  if (pendingInteraction.value?.pointerId === event.pointerId) {
    clearPendingInteraction(event.pointerId)
    return
  }

  flushPendingPointer()
  engine.endInteraction(event.pointerId)
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const point = toLocalPoint(event.clientX, event.clientY)
  if (event.ctrlKey || event.metaKey || spacePressed.value) {
    engine.zoomAt(point, Math.max(-10, Math.min(10, event.deltaY)))
  } else if (event.shiftKey) {
    engine.panBy(event.deltaX || event.deltaY, 0)
  } else {
    engine.panBy(event.deltaX, event.deltaY)
  }
}

function onDoubleClick(event: MouseEvent): void {
  if (isEditorTarget(event.target) || findHandle(event.target) || isBoardInteractiveTarget(event.target)) {
    return
  }
  const screenPoint = toLocalPoint(event.clientX, event.clientY)
  const nodeId = findNodeId(event.target) ?? findNodeIdAtPoint(screenPoint)
  if (nodeId) {
    engine.beginTextEdit(asNodeId(nodeId))
    return
  }
  const world = engine.screenToWorld(screenPoint)
  const node = engine.createNode({
    type: 'text',
    x: world.x,
    y: world.y,
    data: { content: 'New node' }
  })
  if (node) {
    engine.beginTextEdit(node.id)
  }
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
  const history = (engine.ext as unknown as { history?: { undo: () => void; redo: () => void } }).history
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
    event.preventDefault()
    if (event.shiftKey) {
      history?.redo()
    } else {
      history?.undo()
    }
    return
  }
  if (mod && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    history?.redo()
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

function resolveRenderer(node: BoardNodeState): Component | null {
  return renderersRef.value[node.type] ?? props.fallbackRenderer
}

function hasCustomContentForNode(node: BoardNodeState): boolean {
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
