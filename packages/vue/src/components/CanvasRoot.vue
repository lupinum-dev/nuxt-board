<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import {
  createCanvasEngine,
  type CanvasDiagnosticsEvent,
  type CanvasEngine,
  type CanvasEngineSnapshot,
  type Point,
  type ResizeHandle
} from '@canvas/core'
import { canvasEngineKey, type CanvasRenderStats } from '../context'
import CanvasViewport from './CanvasViewport.vue'

const props = withDefaults(
  defineProps<{
    engine?: CanvasEngine
    debug?: boolean
    cullMargin?: number
  }>(),
  {
    engine: undefined,
    debug: false,
    cullMargin: 200
  }
)

const emit = defineEmits<{
  ready: [engine: CanvasEngine]
}>()

const root = ref<HTMLElement | null>(null)
const ownedEngine = props.engine ?? createCanvasEngine()
const snapshot = shallowRef<CanvasEngineSnapshot>(ownedEngine.getSnapshot())
const viewportSize = ref<Point>({ x: 0, y: 0 })
const visibleNodeCount = ref(0)
const renderCount = ref(0)
const lastPerformanceSample = ref<CanvasDiagnosticsEvent | null>(null)
const lastInvariantFailure = ref<CanvasDiagnosticsEvent | null>(null)
const lastEvents = ref<CanvasDiagnosticsEvent[]>([])

const renderStats: CanvasRenderStats = {
  visibleNodeCount,
  renderCount,
  lastPerformanceSample,
  lastInvariantFailure,
  incrementRenderCount() {
    renderCount.value += 1
  },
  setVisibleNodeCount(count) {
    visibleNodeCount.value = count
  },
  consumeEvent(event) {
    if (event.type === 'performance:sample') {
      lastPerformanceSample.value = event
    }
    if (event.type === 'invariant:failed') {
      lastInvariantFailure.value = event
    }
  }
}

provide(canvasEngineKey, {
  engine: ownedEngine,
  snapshot,
  viewportSize,
  renderStats
})

const unsubscribe = ownedEngine.subscribe((event) => {
  renderStats.consumeEvent(event)
  if (event.type === 'state:changed') {
    snapshot.value = event.snapshot
  }
  lastEvents.value = [...lastEvents.value.slice(-19), event]
})

const debugState = computed(() => ({
  camera: snapshot.value.camera,
  selection: snapshot.value.selection,
  interaction: snapshot.value.interaction,
  visibleNodeCount: visibleNodeCount.value,
  renderCount: renderCount.value,
  lastPerformanceSample: lastPerformanceSample.value?.type === 'performance:sample'
    ? lastPerformanceSample.value.sample
    : null,
  lastInvariantFailure: lastInvariantFailure.value?.type === 'invariant:failed'
    ? lastInvariantFailure.value.failure.message
    : null,
  recentEvents: lastEvents.value
}))

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function getNiceWorldStep(zoom: number): number {
  const targetScreenStep = 32
  const roughWorldStep = targetScreenStep / Math.max(zoom, 0.0001)
  const exponent = Math.floor(Math.log10(roughWorldStep))
  const magnitude = Math.pow(10, exponent)
  const fraction = roughWorldStep / magnitude

  let niceFraction = 1
  if (fraction > 5) {
    niceFraction = 10
  } else if (fraction > 2) {
    niceFraction = 5
  } else if (fraction > 1) {
    niceFraction = 2
  }

  return niceFraction * magnitude
}

const gridStyle = computed(() => {
  const zoom = snapshot.value.camera.z
  const minorWorldStep = getNiceWorldStep(zoom)
  const majorWorldStep = minorWorldStep * 5
  const minorScreenStep = minorWorldStep * zoom
  const majorScreenStep = majorWorldStep * zoom
  const cameraScreenX = snapshot.value.camera.x * zoom
  const cameraScreenY = snapshot.value.camera.y * zoom

  return {
    '--grid-minor-size': `${minorScreenStep}px`,
    '--grid-major-size': `${majorScreenStep}px`,
    '--grid-minor-x': `${modulo(cameraScreenX, minorScreenStep)}px`,
    '--grid-minor-y': `${modulo(cameraScreenY, minorScreenStep)}px`,
    '--grid-major-x': `${modulo(cameraScreenX, majorScreenStep)}px`,
    '--grid-major-y': `${modulo(cameraScreenY, majorScreenStep)}px`
  }
})

const rootClasses = computed(() => ({
  'is-panning': snapshot.value.interaction.mode === 'panning'
}))

function updateViewportSize(): void {
  const element = root.value
  if (!element) {
    return
  }
  const rect = element.getBoundingClientRect()
  viewportSize.value = { x: rect.width, y: rect.height }
}

function toLocalPoint(clientX: number, clientY: number): Point {
  const rect = root.value?.getBoundingClientRect()
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0)
  }
}

function findNodeId(target: EventTarget | null): string | undefined {
  if (!(target instanceof HTMLElement)) {
    return undefined
  }
  return target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
}

function findHandle(target: EventTarget | null): string | undefined {
  if (!(target instanceof HTMLElement)) {
    return undefined
  }
  return target.closest<HTMLElement>('[data-resize]')?.dataset.resize
}

function isEditorTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-editor="true"]'))
}

function onPointerDown(event: PointerEvent): void {
  if (isEditorTarget(event.target)) {
    return
  }

  if (event.button === 1) {
    event.preventDefault()
    ownedEngine.beginPan(event.pointerId, toLocalPoint(event.clientX, event.clientY))
    root.value?.setPointerCapture(event.pointerId)
    root.value?.focus()
    return
  }

  if (event.button !== 0) {
    return
  }

  const point = toLocalPoint(event.clientX, event.clientY)
  const nodeId = findNodeId(event.target)
  const handle = findHandle(event.target)

  if (handle && nodeId) {
    ownedEngine.beginResize(nodeId, handle as ResizeHandle, event.pointerId, point)
  } else if (nodeId) {
    ownedEngine.beginNodeDrag(nodeId, event.pointerId, point)
  } else {
    ownedEngine.clearSelection()
    ownedEngine.beginPan(event.pointerId, point)
  }

  root.value?.setPointerCapture(event.pointerId)
  root.value?.focus()
}

function onMouseDown(event: MouseEvent): void {
  if (event.button === 1) {
    event.preventDefault()
  }
}

function onAuxClick(event: MouseEvent): void {
  if (event.button === 1) {
    event.preventDefault()
  }
}

function onPointerMove(event: PointerEvent): void {
  ownedEngine.updatePointer(event.pointerId, toLocalPoint(event.clientX, event.clientY))
}

function onPointerUp(event: PointerEvent): void {
  ownedEngine.endInteraction(event.pointerId)
  if (root.value?.hasPointerCapture(event.pointerId)) {
    root.value.releasePointerCapture(event.pointerId)
  }
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const point = toLocalPoint(event.clientX, event.clientY)
  if (event.ctrlKey || event.metaKey) {
    const delta = Math.max(-10, Math.min(10, event.deltaY))
    ownedEngine.zoomAtScreenPoint(point, delta)
  } else {
    ownedEngine.panByScreenDelta(event.deltaX, event.deltaY)
  }
}

function onDoubleClick(event: MouseEvent): void {
  if (findHandle(event.target)) {
    return
  }

  const nodeId = findNodeId(event.target)
  if (nodeId) {
    ownedEngine.beginTextEdit(nodeId)
    return
  }

  const point = toLocalPoint(event.clientX, event.clientY)
  const world = ownedEngine.screenToWorld(point)
  const node = ownedEngine.createNode({
    x: world.x,
    y: world.y,
    text: 'New card'
  })
  ownedEngine.beginTextEdit(node.id)
}

function onKeyDown(event: KeyboardEvent): void {
  if (snapshot.value.interaction.mode === 'editing-text') {
    return
  }

  if (event.key === 'Escape') {
    ownedEngine.clearSelection()
    ownedEngine.endInteraction()
    return
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (snapshot.value.selection.length > 0) {
      event.preventDefault()
      ownedEngine.deleteSelected()
    }
  }
}

onMounted(() => {
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
  emit('ready', ownedEngine)
})

onBeforeUnmount(() => {
  unsubscribe()
  window.removeEventListener('resize', updateViewportSize)
})

defineExpose({
  engine: ownedEngine,
  debugState
})
</script>

<template>
  <div
    ref="root"
    class="canvas-root"
    :class="rootClasses"
    :data-grid-minor="gridStyle['--grid-minor-size']"
    :data-grid-major="gridStyle['--grid-major-size']"
    tabindex="0"
    @mousedown="onMouseDown"
    @auxclick="onAuxClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @keydown="onKeyDown"
  >
    <div class="canvas-root__backdrop" />
    <div class="canvas-root__grid" :style="gridStyle" />
    <CanvasViewport :cull-margin="cullMargin" />
    <slot :engine="ownedEngine" :snapshot="snapshot" :debug-state="debugState" />
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
  overscroll-behavior: none;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 32%),
    radial-gradient(circle at bottom right, rgba(250, 204, 21, 0.12), transparent 24%),
    linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  cursor: default;
}

.canvas-root.is-panning {
  cursor: grabbing;
}

.canvas-root__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.58), transparent 36%),
    radial-gradient(circle at bottom right, rgba(191, 219, 254, 0.28), transparent 28%);
  pointer-events: none;
}

.canvas-root__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
    linear-gradient(to right, rgba(71, 85, 105, 0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(71, 85, 105, 0.16) 1px, transparent 1px);
  background-size:
    var(--grid-minor-size) var(--grid-minor-size),
    var(--grid-minor-size) var(--grid-minor-size),
    var(--grid-major-size) var(--grid-major-size),
    var(--grid-major-size) var(--grid-major-size);
  background-position:
    var(--grid-minor-x) var(--grid-minor-y),
    var(--grid-minor-x) var(--grid-minor-y),
    var(--grid-major-x) var(--grid-major-y),
    var(--grid-major-x) var(--grid-major-y);
  mask-image: radial-gradient(circle at center, black 65%, transparent 100%);
}
</style>
