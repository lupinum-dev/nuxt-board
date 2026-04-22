import type { Action, EdgeId } from '@lupinum/board-core'
import type { BoardEdge } from './types'

export interface ConnectionsSliceState {
  readonly edges: ReadonlyMap<EdgeId, BoardEdge>
  readonly nextZIndex: number
}

export type ConnectionsAction =
  | { type: 'EDGE_CREATED'; edge: BoardEdge }
  | { type: 'EDGE_UPDATED'; id: EdgeId; before: BoardEdge; after: BoardEdge }
  | { type: 'EDGE_DELETED'; id: EdgeId; edge: BoardEdge }

export const SLICE_NAME = 'connections'

export const initialState: ConnectionsSliceState = {
  edges: new Map(),
  nextZIndex: 1
}

function isConnectionsAction(action: Action): action is Action & { type: 'PLUGIN'; plugin: typeof SLICE_NAME; action: ConnectionsAction } {
  return action.type === 'PLUGIN' && action.plugin === SLICE_NAME
}

export function invert(action: ConnectionsAction): ConnectionsAction {
  switch (action.type) {
    case 'EDGE_CREATED':
      return { type: 'EDGE_DELETED', id: action.edge.id, edge: action.edge }
    case 'EDGE_DELETED':
      return { type: 'EDGE_CREATED', edge: action.edge }
    case 'EDGE_UPDATED':
      return { type: 'EDGE_UPDATED', id: action.id, before: action.after, after: action.before }
  }
}

export function reducer(state: ConnectionsSliceState, action: Action): ConnectionsSliceState {
  if (isConnectionsAction(action)) {
    const inner = action.action
    switch (inner.type) {
      case 'EDGE_CREATED': {
        const edges = new Map(state.edges)
        edges.set(inner.edge.id, inner.edge)
        return {
          edges,
          nextZIndex: Math.max(state.nextZIndex, inner.edge.zIndex + 1)
        }
      }
      case 'EDGE_UPDATED': {
        const edges = new Map(state.edges)
        edges.set(inner.id, inner.after)
        return { ...state, edges }
      }
      case 'EDGE_DELETED': {
        if (!state.edges.has(inner.id)) return state
        const edges = new Map(state.edges)
        edges.delete(inner.id)
        return { ...state, edges }
      }
    }
  }

  if (action.type === 'BATCH') {
    return action.actions.reduce(reducer, state)
  }

  return state
}
