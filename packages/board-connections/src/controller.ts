import type { NodeId, Point } from '@lupinum/board-core'
import type { AnchorPosition, AnchorSide } from './types.js'

export type DragEnd = 'from' | 'to'

export type ReconnectDragState = {
  mode: 'reconnect'
  edgeId: string
  end: DragEnd
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
  candidateAnchor: AnchorPosition | null
}

export type CreateDragState = {
  mode: 'create'
  sourceNodeId: NodeId
  sourceSide: AnchorSide
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
  candidateAnchor: AnchorPosition | null
}

export type ConnectionDragState = ReconnectDragState | CreateDragState

export type PendingConnectionDrag =
  | {
      mode: 'reconnect'
      edgeId: string
      end: DragEnd
      pointerId: number
      startWorld: Point
    }
  | {
      mode: 'create'
      sourceNodeId: NodeId
      sourceSide: AnchorSide
      pointerId: number
      startWorld: Point
    }

interface AdvanceDragInput {
  pending: PendingConnectionDrag | null
  active: ConnectionDragState | null
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
  candidateAnchor: AnchorPosition | null
  zoom: number
  threshold: number
}

export function advanceConnectionDrag(input: AdvanceDragInput): {
  pending: PendingConnectionDrag | null
  active: ConnectionDragState | null
} {
  const expectedPointerId = input.active?.pointerId ?? input.pending?.pointerId
  if (
    expectedPointerId === undefined ||
    expectedPointerId !== input.pointerId
  ) {
    return { pending: input.pending, active: input.active }
  }

  if (input.pending) {
    const screenDistance =
      Math.hypot(
        input.pointerWorld.x - input.pending.startWorld.x,
        input.pointerWorld.y - input.pending.startWorld.y,
      ) * input.zoom
    if (screenDistance < input.threshold) {
      return { pending: input.pending, active: null }
    }

    const shared = {
      pointerId: input.pending.pointerId,
      pointerWorld: input.pointerWorld,
      candidateNodeId: input.candidateNodeId,
      candidateAnchor: input.candidateAnchor,
    }
    return {
      pending: null,
      active:
        input.pending.mode === 'reconnect'
          ? {
              ...shared,
              mode: 'reconnect',
              edgeId: input.pending.edgeId,
              end: input.pending.end,
            }
          : {
              ...shared,
              mode: 'create',
              sourceNodeId: input.pending.sourceNodeId,
              sourceSide: input.pending.sourceSide,
            },
    }
  }

  if (!input.active) return { pending: null, active: null }
  return {
    pending: null,
    active: {
      ...input.active,
      pointerWorld: input.pointerWorld,
      candidateNodeId: input.candidateNodeId,
      candidateAnchor: input.candidateAnchor,
    },
  }
}
