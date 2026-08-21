import { onBeforeUnmount, shallowRef, type Ref } from 'vue'
import {
  asNodeId,
  type BoardEngine,
  type BoardNode,
  type Point,
  type ResizeHandle,
} from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'
import { runBoardCommand, tryBoardCommand } from './runBoardCommand.js'
import {
  isBoardInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '../eventTargets.js'

const POINTER_DRAG_THRESHOLD = 6

interface ActivePointer {
  point: Point
  type: string
}

type TouchInteractionState =
  | { kind: 'idle' }
  | { kind: 'pending-pan'; pointerId: number; startPoint: Point }
  | {
      kind: 'pinch'
      previousDistance: number
      previousMidpoint: Point
    }

type PendingPointerInteraction =
  | { kind: 'drag'; pointerId: number; startPoint: Point; nodeId: string }
  | {
      kind: 'resize'
      pointerId: number
      startPoint: Point
      nodeId: string
      handle: ResizeHandle
    }
  | { kind: 'box-select'; pointerId: number; startPoint: Point }

/** Options for translating DOM pointer events into board-engine commands. */
interface UsePointerInteractionOptions {
  engine: BoardEngine
  rootElement: Ref<HTMLElement | null>
  spacePressed: Ref<boolean>
  toLocalPoint: (clientX: number, clientY: number) => Point
  onContextMenu?: (info: BoardContextMenuInfo) => void
}

/** Information emitted when the user opens a board context menu. */
export interface BoardContextMenuInfo {
  event: MouseEvent
  node: BoardNode | null
  world: Point
  screen: Point
}

function findNodeId(target: EventTarget | null): string | undefined {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    : undefined
}

function findHandle(target: EventTarget | null): ResizeHandle | undefined {
  return target instanceof HTMLElement
    ? (target.closest<HTMLElement>('[data-resize]')?.dataset.resize as
        ResizeHandle | undefined)
    : undefined
}

/**
 * Translate pointer input from `BoardRoot` into engine commands.
 *
 * This composable owns drag thresholds, pinch zoom, deferred interactions,
 * and the mapping from DOM targets to node drag / resize / selection flows.
 */
export function usePointerInteraction(options: UsePointerInteractionOptions) {
  const { engine, rootElement, spacePressed, toLocalPoint } = options
  const interaction = getBoardInteractionAdapter(engine)

  const pendingInteraction = shallowRef<PendingPointerInteraction | null>(null)
  const activePointers = new Map<number, ActivePointer>()
  let touchInteraction: TouchInteractionState = { kind: 'idle' }
  let pendingPointer: {
    id: number
    point: Point
    shift: boolean
    space: boolean
  } | null = null
  let rafScheduled = false
  let rafId: number | null = null

  function findNodeIdAtPoint(screenPoint: Point): string | undefined {
    const world = engine.screenToWorld(screenPoint)
    return engine.getNodeAt(world)?.id
  }

  function getPinchDistance(): number {
    const pts = getActiveTouchPoints()
    const p1 = pts[0]
    const p2 = pts[1]
    if (!p1 || !p2) return 0
    return Math.hypot(p2.x - p1.x, p2.y - p1.y)
  }

  function getPinchMidpoint(): Point {
    const pts = getActiveTouchPoints()
    const p1 = pts[0]
    const p2 = pts[1]
    if (!p1 || !p2) return { x: 0, y: 0 }
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  }

  function getActiveTouchPoints(): Point[] {
    return [...activePointers.values()]
      .filter((pointer) => pointer.type === 'touch')
      .map((pointer) => pointer.point)
  }

  function startPointerInteraction(
    pointerId: number,
    point: Point,
    kind: 'pan' | 'drag' | 'resize' | 'box-select',
    nodeId?: string,
    handle?: ResizeHandle,
  ): boolean {
    const started = tryBoardCommand(() => {
      if (kind === 'pan') {
        interaction.beginPan(pointerId, point)
      } else if (kind === 'drag' && nodeId) {
        interaction.beginNodeDrag(asNodeId(nodeId), pointerId, point)
      } else if (kind === 'resize' && nodeId && handle) {
        interaction.beginResize(asNodeId(nodeId), handle, pointerId, point)
      } else {
        interaction.beginBoxSelect(pointerId, point)
      }
    })
    if (started) {
      rootElement.value?.focus()
    }
    return started
  }

  function clearPendingInteraction(pointerId?: number): void {
    if (!pendingInteraction.value) return
    if (
      pointerId !== undefined &&
      pendingInteraction.value.pointerId !== pointerId
    )
      return
    pendingInteraction.value = null
  }

  function exceedsPointerThreshold(
    startPoint: Point,
    nextPoint: Point,
  ): boolean {
    return (
      Math.hypot(nextPoint.x - startPoint.x, nextPoint.y - startPoint.y) >=
      POINTER_DRAG_THRESHOLD
    )
  }

  function beginDeferredInteraction(
    event: PointerEvent,
    nodeId?: string,
    handle?: ResizeHandle,
  ): void {
    const point = toLocalPoint(event.clientX, event.clientY)
    rootElement.value?.setPointerCapture(event.pointerId)
    rootElement.value?.focus()

    if (handle && nodeId) {
      if (!tryBoardCommand(() => engine.select(asNodeId(nodeId)))) return
      pendingInteraction.value = {
        kind: 'resize',
        pointerId: event.pointerId,
        startPoint: point,
        nodeId,
        handle,
      }
      return
    }

    if (nodeId) {
      const selection = engine.getSelection()
      if (!selection.includes(asNodeId(nodeId))) {
        if (!tryBoardCommand(() => engine.select(asNodeId(nodeId)))) return
      }
      pendingInteraction.value = {
        kind: 'drag',
        pointerId: event.pointerId,
        startPoint: point,
        nodeId,
      }
      return
    }

    if (!tryBoardCommand(() => engine.clearSelection())) return
    pendingInteraction.value = {
      kind: 'box-select',
      pointerId: event.pointerId,
      startPoint: point,
    }
  }

  function startPendingInteraction(event: PointerEvent, point: Point): boolean {
    const pending = pendingInteraction.value
    if (
      !pending ||
      pending.pointerId !== event.pointerId ||
      !exceedsPointerThreshold(pending.startPoint, point)
    ) {
      return false
    }

    let started = false
    if (pending.kind === 'drag') {
      if (event.altKey) {
        const sourceNode = engine.findNode(asNodeId(pending.nodeId))
        const duplicated = runBoardCommand(() =>
          engine.duplicateNodes(engine.getSelection(), { x: 0, y: 0 }),
        )
        const created = duplicated?.nodes ?? []
        const duplicatedId = sourceNode
          ? duplicated?.idMap.get(sourceNode.id)
          : undefined
        const dragNode =
          (duplicatedId
            ? created.find((node) => node.id === duplicatedId)
            : undefined) ?? created[0]
        if (dragNode) {
          started = startPointerInteraction(
            event.pointerId,
            pending.startPoint,
            'drag',
            String(dragNode.id),
          )
        }
      } else {
        started = startPointerInteraction(
          event.pointerId,
          pending.startPoint,
          'drag',
          pending.nodeId,
        )
      }
    } else if (pending.kind === 'resize') {
      started = startPointerInteraction(
        event.pointerId,
        pending.startPoint,
        'resize',
        pending.nodeId,
        pending.handle,
      )
    } else {
      started = startPointerInteraction(
        event.pointerId,
        pending.startPoint,
        'box-select',
      )
    }

    pendingInteraction.value = null
    return started
  }

  function flushPendingPointer(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pendingPointer) {
      runBoardCommand(() =>
        interaction.updatePointer(pendingPointer!.id, pendingPointer!.point, {
          shift: pendingPointer!.shift,
          space: pendingPointer!.space,
        }),
      )
      pendingPointer = null
      rafScheduled = false
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    const localPoint = toLocalPoint(event.clientX, event.clientY)
    activePointers.set(event.pointerId, {
      point: localPoint,
      type: event.pointerType,
    })

    if (getActiveTouchPoints().length === 2 && event.pointerType === 'touch') {
      runBoardCommand(() => interaction.endInteraction())
      event.preventDefault()
      rootElement.value?.setPointerCapture(event.pointerId)
      clearPendingInteraction()
      pendingPointer = null
      touchInteraction = {
        kind: 'pinch',
        previousDistance: getPinchDistance(),
        previousMidpoint: getPinchMidpoint(),
      }
      return
    }

    if (event.button === 1 || spacePressed.value) {
      event.preventDefault()
      rootElement.value?.setPointerCapture(event.pointerId)
      startPointerInteraction(event.pointerId, localPoint, 'pan')
      return
    }
    if (event.button !== 0) return

    const nodeId = findNodeId(event.target)
    const handle = findHandle(event.target)
    if (event.pointerType === 'touch' && !nodeId && !handle) {
      event.preventDefault()
      rootElement.value?.setPointerCapture(event.pointerId)
      rootElement.value?.focus()
      touchInteraction = {
        kind: 'pending-pan',
        pointerId: event.pointerId,
        startPoint: localPoint,
      }
      return
    }
    beginDeferredInteraction(event, nodeId, handle)
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return

    const localPoint = toLocalPoint(event.clientX, event.clientY)
    const activePointer = activePointers.get(event.pointerId)

    if (!activePointer) {
      return
    }

    activePointers.set(event.pointerId, {
      point: localPoint,
      type: activePointer.type,
    })

    if (touchInteraction.kind === 'pinch') {
      const pinch = touchInteraction
      const newDist = getPinchDistance()
      const midpoint = getPinchMidpoint()
      if (pinch.previousDistance > 0 && newDist > 0) {
        runBoardCommand(() =>
          engine.panBy(
            midpoint.x - pinch.previousMidpoint.x,
            midpoint.y - pinch.previousMidpoint.y,
          ),
        )
        const ratio = newDist / pinch.previousDistance
        const delta = -100 * Math.log2(ratio)
        runBoardCommand(() => engine.zoomAt(midpoint, delta))
      }
      touchInteraction = {
        kind: 'pinch',
        previousDistance: newDist,
        previousMidpoint: midpoint,
      }
      return
    }

    if (
      touchInteraction.kind === 'pending-pan' &&
      event.pointerId === touchInteraction.pointerId
    ) {
      if (!exceedsPointerThreshold(touchInteraction.startPoint, localPoint)) {
        return
      }
      const pending = touchInteraction
      touchInteraction = { kind: 'idle' }
      startPointerInteraction(event.pointerId, pending.startPoint, 'pan')
    }

    const startedPendingInteraction = startPendingInteraction(event, localPoint)
    if (
      !startedPendingInteraction &&
      pendingInteraction.value?.pointerId === event.pointerId
    ) {
      return
    }

    pendingPointer = {
      id: event.pointerId,
      point: localPoint,
      shift: event.shiftKey,
      space: spacePressed.value,
    }
    if (!rafScheduled) {
      rafScheduled = true
      rafId = requestAnimationFrame(() => {
        if (pendingPointer) {
          runBoardCommand(() =>
            interaction.updatePointer(
              pendingPointer!.id,
              pendingPointer!.point,
              {
                shift: pendingPointer!.shift,
                space: pendingPointer!.space,
              },
            ),
          )
        }
        rafScheduled = false
        rafId = null
        pendingPointer = null
      })
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return

    activePointers.delete(event.pointerId)

    if (rootElement.value?.hasPointerCapture(event.pointerId)) {
      rootElement.value.releasePointerCapture(event.pointerId)
    }

    if (touchInteraction.kind === 'pinch') {
      if (getActiveTouchPoints().length < 2) {
        touchInteraction = { kind: 'idle' }
        clearPendingInteraction()
        runBoardCommand(() => interaction.endInteraction())
      }
      return
    }

    if (
      touchInteraction.kind === 'pending-pan' &&
      event.pointerId === touchInteraction.pointerId
    ) {
      touchInteraction = { kind: 'idle' }
      runBoardCommand(() => engine.clearSelection())
      return
    }

    if (pendingInteraction.value?.pointerId === event.pointerId) {
      clearPendingInteraction(event.pointerId)
      return
    }

    flushPendingPointer()
    runBoardCommand(() => interaction.endInteraction(event.pointerId))
  }

  function onPointerCancel(event: PointerEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return

    activePointers.delete(event.pointerId)
    touchInteraction = { kind: 'idle' }
    clearPendingInteraction(event.pointerId)
    pendingPointer = null
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    rafScheduled = false
    runBoardCommand(() => interaction.cancelInteraction(event.pointerId))
  }

  function onWheel(event: WheelEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    event.preventDefault()
    const point = toLocalPoint(event.clientX, event.clientY)
    if (event.ctrlKey || event.metaKey || spacePressed.value) {
      runBoardCommand(() =>
        engine.zoomAt(point, Math.max(-10, Math.min(10, event.deltaY))),
      )
    } else if (event.shiftKey) {
      runBoardCommand(() => engine.panBy(event.deltaX || event.deltaY, 0))
    } else {
      runBoardCommand(() => engine.panBy(event.deltaX, event.deltaY))
    }
  }

  function onContextMenu(event: MouseEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    const screen = toLocalPoint(event.clientX, event.clientY)
    const world = engine.screenToWorld(screen)
    const nodeId = findNodeId(event.target) ?? findNodeIdAtPoint(screen)
    options.onContextMenu?.({
      event,
      node: nodeId ? engine.findNode(asNodeId(nodeId)) : null,
      world,
      screen,
    })
  }

  function onPaste(event: ClipboardEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    const data = event.clipboardData
    const payload = {
      text: data?.getData('text/plain') ?? '',
      files: Array.from(data?.files ?? []),
    }
    const viewport = rootElement.value
    const offset = viewport
      ? engine.screenToWorld({
          x: viewport.clientWidth / 2,
          y: viewport.clientHeight / 2,
        })
      : undefined
    const external = runBoardCommand(() => engine.pasteData(payload, offset))
    if (external && external.length > 0) {
      event.preventDefault()
      return
    }
    const internal = runBoardCommand(() => engine.pasteClipboard())
    if (internal && internal.length > 0) event.preventDefault()
  }

  function onDoubleClick(event: MouseEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (
      isBoardInteractiveEventTarget(event.target) ||
      findHandle(event.target)
    ) {
      return
    }
    const screenPoint = toLocalPoint(event.clientX, event.clientY)
    const nodeId = findNodeId(event.target) ?? findNodeIdAtPoint(screenPoint)
    if (nodeId) {
      const id = asNodeId(nodeId)
      if (engine.getNode(id).type === 'text') {
        runBoardCommand(() => engine.beginTextEdit(id))
      }
      return
    }
    const world = engine.screenToWorld(screenPoint)
    const node = runBoardCommand(() =>
      engine.createNode({
        type: 'text',
        x: world.x,
        y: world.y,
        text: 'New node',
      }),
    )
    if (node) {
      runBoardCommand(() => engine.beginTextEdit(node.id))
    }
  }

  onBeforeUnmount(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    rafScheduled = false
    pendingPointer = null
    activePointers.clear()
    touchInteraction = { kind: 'idle' }
    clearPendingInteraction()
    runBoardCommand(() => interaction.cancelInteraction())
  })

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    onDoubleClick,
    onContextMenu,
    onPaste,
  }
}
