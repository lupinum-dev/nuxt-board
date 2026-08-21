import type { Point, ResizeHandle } from '@lupinum/board-core'

export type TouchIntent =
  | { kind: 'pan' }
  | { kind: 'drag'; nodeId: string }
  | { kind: 'resize'; nodeId: string; handle: ResizeHandle }

type TouchPoint = { pointerId: number; point: Point }

export type TouchSessionState =
  | { kind: 'idle' }
  | {
      kind: 'pending'
      pointer: TouchPoint
      startPoint: Point
      intent: TouchIntent
    }
  | { kind: 'active-single'; pointer: TouchPoint; intent: TouchIntent }
  | {
      kind: 'pinch'
      pointers: readonly [TouchPoint, TouchPoint]
      previousDistance: number
      previousMidpoint: Point
    }

interface TouchSessionActions {
  dragThreshold: number
  start(intent: TouchIntent, pointerId: number, startPoint: Point): boolean
  update(pointerId: number, point: Point): void
  flush(): void
  cancelQueued(): void
  end(pointerId?: number): void
  cancel(pointerId?: number): void
  clearSelection(): void
  updatePinch(midpoint: Point, pan: Point, zoomDelta: number): void
}

function distance([first, second]: readonly [TouchPoint, TouchPoint]): number {
  return Math.hypot(
    second.point.x - first.point.x,
    second.point.y - first.point.y,
  )
}

function midpoint([first, second]: readonly [TouchPoint, TouchPoint]): Point {
  return {
    x: (first.point.x + second.point.x) / 2,
    y: (first.point.y + second.point.y) / 2,
  }
}

function replacePoint(
  pointers: readonly [TouchPoint, TouchPoint],
  pointerId: number,
  point: Point,
): readonly [TouchPoint, TouchPoint] {
  return pointers[0].pointerId === pointerId
    ? [{ pointerId, point }, pointers[1]]
    : [pointers[0], { pointerId, point }]
}

/** Own the complete one- and two-finger session as one discriminated state. */
export function createTouchSession(actions: TouchSessionActions) {
  let state: TouchSessionState = { kind: 'idle' }

  function pointerDown(
    pointerId: number,
    point: Point,
    intent: TouchIntent,
  ): void {
    if (state.kind === 'pinch') return
    if (state.kind === 'idle') {
      state = {
        kind: 'pending',
        pointer: { pointerId, point },
        startPoint: point,
        intent,
      }
      return
    }

    actions.cancelQueued()
    actions.cancel(state.pointer.pointerId)
    const pointers: [TouchPoint, TouchPoint] = [
      state.pointer,
      { pointerId, point },
    ]
    state = {
      kind: 'pinch',
      pointers,
      previousDistance: distance(pointers),
      previousMidpoint: midpoint(pointers),
    }
  }

  function pointerMove(pointerId: number, point: Point): void {
    if (state.kind === 'idle') return
    if (state.kind === 'pinch') {
      if (!state.pointers.some((pointer) => pointer.pointerId === pointerId)) {
        return
      }
      const pointers = replacePoint(state.pointers, pointerId, point)
      const nextDistance = distance(pointers)
      const nextMidpoint = midpoint(pointers)
      if (state.previousDistance > 0 && nextDistance > 0) {
        actions.updatePinch(
          nextMidpoint,
          {
            x: nextMidpoint.x - state.previousMidpoint.x,
            y: nextMidpoint.y - state.previousMidpoint.y,
          },
          -100 * Math.log2(nextDistance / state.previousDistance),
        )
      }
      state = {
        kind: 'pinch',
        pointers,
        previousDistance: nextDistance,
        previousMidpoint: nextMidpoint,
      }
      return
    }
    if (state.pointer.pointerId !== pointerId) return

    if (state.kind === 'pending') {
      const moved = Math.hypot(
        point.x - state.startPoint.x,
        point.y - state.startPoint.y,
      )
      if (moved < actions.dragThreshold) {
        state = { ...state, pointer: { pointerId, point } }
        return
      }
      const { intent, startPoint } = state
      if (!actions.start(intent, pointerId, startPoint)) {
        state = { kind: 'idle' }
        return
      }
      state = {
        kind: 'active-single',
        pointer: { pointerId, point },
        intent,
      }
      actions.update(pointerId, point)
      return
    }

    state = { ...state, pointer: { pointerId, point } }
    actions.update(pointerId, point)
  }

  function pointerUp(pointerId: number): void {
    if (state.kind === 'idle') return
    if (state.kind === 'pinch') {
      if (state.pointers.some((pointer) => pointer.pointerId === pointerId)) {
        actions.cancelQueued()
        actions.end()
        state = { kind: 'idle' }
      }
      return
    }
    if (state.pointer.pointerId !== pointerId) return

    if (state.kind === 'pending') {
      if (state.intent.kind === 'pan') actions.clearSelection()
    } else {
      actions.flush()
      actions.end(pointerId)
    }
    state = { kind: 'idle' }
  }

  function pointerCancel(pointerId?: number): void {
    if (state.kind === 'idle') return
    if (
      pointerId !== undefined &&
      state.kind !== 'pinch' &&
      state.pointer.pointerId !== pointerId
    ) {
      return
    }
    actions.cancelQueued()
    actions.cancel(pointerId)
    state = { kind: 'idle' }
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    getState: () => state,
  }
}
