import type { Action } from '../state/actions'

type PluginInverter = (innerAction: unknown) => unknown
type PluginInverterLookup = (pluginName: string) => PluginInverter | undefined

export function invertAction(
  action: Action,
  lookup: PluginInverterLookup,
): Action {
  switch (action.type) {
    case 'NODE_CREATED':
      return { type: 'NODE_DELETED', node: action.node }
    case 'NODE_DELETED':
      return { type: 'NODE_CREATED', node: action.node }
    case 'NODE_UPDATED':
      return {
        type: 'NODE_UPDATED',
        id: action.id,
        before: action.after,
        after: action.before,
      }
    case 'NODES_MOVED':
      return {
        type: 'NODES_MOVED',
        deltas: action.deltas.map((delta) => ({
          id: delta.id,
          before: delta.after,
          after: delta.before,
        })),
      }
    case 'SELECTION_SET':
      return {
        type: 'SELECTION_SET',
        before: action.after,
        after: action.before,
      }
    case 'GRID_UPDATED':
      return {
        type: 'GRID_UPDATED',
        before: action.after,
        after: action.before,
      }
    case 'NEXT_Z_INDEX_BUMPED':
      return {
        type: 'NEXT_Z_INDEX_BUMPED',
        before: action.after,
        after: action.before,
      }
    case 'BATCH':
      return {
        type: 'BATCH',
        actions: [...action.actions]
          .reverse()
          .map((inner) => invertAction(inner, lookup)),
      }
    case 'FEATURE_ACTION': {
      const invert = lookup(action.feature)
      if (!invert) {
        throw new Error(
          `Cannot invert FEATURE_ACTION action: plugin "${action.feature}" did not register an inverter.`,
        )
      }
      return {
        type: 'FEATURE_ACTION',
        feature: action.feature,
        action: invert(action.action),
      }
    }
  }
}
