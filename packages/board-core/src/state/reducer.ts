import type { GridSettings, NodeId, NodeTypeRegistry } from '../types'
import type { Action } from './actions'
import type { StoredNode } from './versioning'
import { bumpVersions } from './versioning'

export interface PersistentBoardState {
  nodes: ReadonlyMap<NodeId, StoredNode>
  selection: ReadonlySet<NodeId>
  grid: GridSettings
  nextZIndex: number
  plugins: Readonly<Record<string, unknown>>
}

export type Reducer<S> = (state: S, action: Action) => S

function applyNodeUpdate(
  nodes: ReadonlyMap<NodeId, StoredNode>,
  id: NodeId,
  before: StoredNode,
  after: StoredNode,
): Map<NodeId, StoredNode> {
  const next = new Map(nodes)
  next.set(id, bumpVersions(before, after))
  return next
}

function nodesReducer(
  state: ReadonlyMap<NodeId, StoredNode>,
  action: Action,
): ReadonlyMap<NodeId, StoredNode> {
  switch (action.type) {
    case 'NODE_CREATED': {
      const next = new Map(state)
      next.set(action.node.id, action.node)
      return next
    }
    case 'NODE_DELETED': {
      const next = new Map(state)
      next.delete(action.node.id)
      return next
    }
    case 'NODE_UPDATED':
      return applyNodeUpdate(state, action.id, action.before, action.after)
    case 'NODES_MOVED': {
      const next = new Map(state)
      for (const delta of action.deltas) {
        const current = next.get(delta.id)
        if (!current) continue
        const updated = bumpVersions(current, {
          ...current,
          x: delta.after.x,
          y: delta.after.y,
        })
        next.set(delta.id, updated)
      }
      return next
    }
    case 'BATCH':
      return action.actions.reduce(nodesReducer, state)
    default:
      return state
  }
}

function selectionReducer(
  state: ReadonlySet<NodeId>,
  action: Action,
): ReadonlySet<NodeId> {
  switch (action.type) {
    case 'SELECTION_SET':
      return new Set(action.after)
    case 'NODE_DELETED': {
      if (!state.has(action.node.id)) return state
      const next = new Set(state)
      next.delete(action.node.id)
      return next
    }
    case 'BATCH':
      return action.actions.reduce(selectionReducer, state)
    default:
      return state
  }
}

function gridReducer(state: GridSettings, action: Action): GridSettings {
  switch (action.type) {
    case 'GRID_UPDATED':
      return { ...action.after }
    case 'BATCH':
      return action.actions.reduce(gridReducer, state)
    default:
      return state
  }
}

function nextZIndexReducer(state: number, action: Action): number {
  switch (action.type) {
    case 'NEXT_Z_INDEX_BUMPED':
      return action.after
    case 'NODE_CREATED':
      return Math.max(state, action.node.zIndex + 1)
    case 'BATCH':
      return action.actions.reduce(nextZIndexReducer, state)
    default:
      return state
  }
}

export type PluginReducer = Reducer<unknown>

export interface RootReducerOptions {
  pluginReducers: ReadonlyMap<string, PluginReducer>
}

export function createRootReducer(
  options: RootReducerOptions,
): Reducer<PersistentBoardState> {
  return function rootReducer(state, action) {
    const nextNodes = nodesReducer(state.nodes, action)
    const nextSelection = selectionReducer(state.selection, action)
    const nextGrid = gridReducer(state.grid, action)
    const nextZ = nextZIndexReducer(state.nextZIndex, action)

    let nextPlugins = state.plugins
    if (options.pluginReducers.size > 0) {
      const draft: Record<string, unknown> = { ...state.plugins }
      let mutated = false
      for (const [name, reducer] of options.pluginReducers) {
        const before = draft[name]
        const after = reducer(before, action)
        if (after !== before) {
          draft[name] = after
          mutated = true
        }
      }
      if (mutated) nextPlugins = draft
    }

    if (
      nextNodes === state.nodes &&
      nextSelection === state.selection &&
      nextGrid === state.grid &&
      nextZ === state.nextZIndex &&
      nextPlugins === state.plugins
    ) {
      return state
    }
    return {
      nodes: nextNodes,
      selection: nextSelection,
      grid: nextGrid,
      nextZIndex: nextZ,
      plugins: nextPlugins,
    }
  }
}

export type _Unused<R extends NodeTypeRegistry> = R
