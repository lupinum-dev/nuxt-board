import type { BoardEngine } from '@lupinum/board-core'
import type { ConnectionsApi, ConnectionsEventMap } from './types.js'

export type ConnectionEngine = BoardEngine<
  { connections: ConnectionsApi },
  ConnectionsEventMap
>

function isConnectionsApi(value: unknown): value is ConnectionsApi {
  if (!value || typeof value !== 'object') return false
  return (
    'getEdges' in value &&
    typeof value.getEdges === 'function' &&
    '$edges' in value &&
    typeof value.$edges === 'object' &&
    value.$edges !== null
  )
}

/** Resolve the installed API at the package boundary with an actionable error. */
export function resolveConnectionEngine(engine: BoardEngine): ConnectionEngine {
  const plugins: object = engine.plugins
  if (!('connections' in plugins) || !isConnectionsApi(plugins.connections)) {
    throw new Error(
      'BoardConnectionLayer requires connectionsPlugin() on its enclosing BoardRoot engine.',
    )
  }
  return engine as ConnectionEngine
}
