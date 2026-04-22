import type { Action } from '../state/actions'

export type PluginInverter = (innerAction: unknown) => unknown
export type PluginInverterLookup = (pluginName: string) => PluginInverter | undefined

export function invertAction(action: Action, lookup: PluginInverterLookup): Action {
  switch (action.type) {
    case 'NODE_CREATED':
      return { type: 'NODE_DELETED', node: action.node }
    case 'NODE_DELETED':
      return { type: 'NODE_CREATED', node: action.node }
    case 'NODE_UPDATED':
      return { type: 'NODE_UPDATED', id: action.id, before: action.after, after: action.before }
    case 'NODES_MOVED':
      return {
        type: 'NODES_MOVED',
        deltas: action.deltas.map((delta) => ({ id: delta.id, before: delta.after, after: delta.before }))
      }
    case 'SELECTION_SET':
      return { type: 'SELECTION_SET', before: action.after, after: action.before }
    case 'GRID_UPDATED':
      return { type: 'GRID_UPDATED', before: action.after, after: action.before }
    case 'NEXT_Z_INDEX_BUMPED':
      return { type: 'NEXT_Z_INDEX_BUMPED', before: action.after, after: action.before }
    case 'BATCH':
      return { type: 'BATCH', actions: [...action.actions].reverse().map((inner) => invertAction(inner, lookup)) }
    case 'PLUGIN': {
      const invert = lookup(action.plugin)
      if (!invert) {
        throw new Error(`Cannot invert PLUGIN action: plugin "${action.plugin}" did not register an inverter.`)
      }
      return { type: 'PLUGIN', plugin: action.plugin, action: invert(action.action) }
    }
  }
}
