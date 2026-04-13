import { asEdgeId, type BoardPlugin, type EdgeId } from '@lupinum/board-core'
import type {
  BoardEdge,
  BoardEdgePatch,
  ConnectionPluginOptions,
  ConnectionRouting,
  ConnectionsExtension,
  EdgeEnd
} from './types'

declare module '@lupinum/board-core' {
  interface BoardEventMap<R extends import('@lupinum/board-core').NodeTypeRegistry = import('@lupinum/board-core').NodeTypeRegistry> {
    'edge:created': (edge: BoardEdge) => void
    'edge:updated': (edge: BoardEdge, prev: BoardEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface BoardEngineExtensions<R extends import('@lupinum/board-core').NodeTypeRegistry = import('@lupinum/board-core').NodeTypeRegistry> {
    connections: ConnectionsExtension
  }
}

function defaultEnds(defaultArrow: NonNullable<ConnectionPluginOptions['defaultArrow']>): {
  fromEnd: EdgeEnd
  toEnd: EdgeEnd
} {
  switch (defaultArrow) {
    case 'start':
      return { fromEnd: 'arrow', toEnd: 'none' }
    case 'both':
      return { fromEnd: 'arrow', toEnd: 'arrow' }
    case 'none':
      return { fromEnd: 'none', toEnd: 'none' }
    case 'end':
    default:
      return { fromEnd: 'none', toEnd: 'arrow' }
  }
}

function cloneEdge<T>(edge: BoardEdge<T>): BoardEdge<T> {
  return {
    ...edge,
    data: structuredClone(edge.data)
  }
}

export function connectionPlugin(options: ConnectionPluginOptions = {}): BoardPlugin {
  const routing = options.routing ?? 'bezier'
  const defaultArrow = options.defaultArrow ?? 'end'
  const defaults = defaultEnds(defaultArrow)

  return {
    name: 'connections',
    install(engine) {
      const edges = new Map<EdgeId, BoardEdge>()
      let nextZIndex = 1

      const api: ConnectionsExtension = {
        createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
        ) {
          return engine.runCommand('edge:create', [input], () => {
            if (!engine.hasNode(input.from)) {
              throw new Error(`Cannot create edge: source node "${input.from}" does not exist.`)
            }
            if (!engine.hasNode(input.to)) {
              throw new Error(`Cannot create edge: target node "${input.to}" does not exist.`)
            }

            const edge: BoardEdge<T> = {
              id: input.id ?? asEdgeId(crypto.randomUUID()),
              from: input.from,
              to: input.to,
              fromAnchor: input.fromAnchor,
              toAnchor: input.toAnchor,
              fromEnd: input.fromEnd ?? defaults.fromEnd,
              toEnd: input.toEnd ?? defaults.toEnd,
              label: input.label,
              color: input.color,
              data: structuredClone(input.data ?? ({} as T)),
              zIndex: input.zIndex ?? nextZIndex++
            }

            nextZIndex = Math.max(nextZIndex, edge.zIndex + 1)
            edges.set(edge.id, edge)
            const cloned = cloneEdge(edge)
            engine.emit('edge:created', cloned)
            return cloned
          }) as BoardEdge<T>
        },
        updateEdge<T extends Record<string, unknown> = Record<string, unknown>>(id: EdgeId, patch: BoardEdgePatch<T>) {
          const current = edges.get(id) as BoardEdge<T> | undefined
          if (!current) {
            throw new Error(`Cannot update edge: edge "${id}" does not exist.`)
          }

          return engine.runCommand('edge:update', [id, patch], () => {
            const nextFrom = 'from' in patch ? patch.from : current.from
            const nextTo = 'to' in patch ? patch.to : current.to
            if (!nextFrom || !engine.hasNode(nextFrom)) {
              throw new Error(`Cannot update edge: source node "${nextFrom}" does not exist.`)
            }
            if (!nextTo || !engine.hasNode(nextTo)) {
              throw new Error(`Cannot update edge: target node "${nextTo}" does not exist.`)
            }

            const next: BoardEdge<T> = {
              ...current,
              from: nextFrom,
              to: nextTo,
              fromAnchor: 'fromAnchor' in patch ? patch.fromAnchor : current.fromAnchor,
              toAnchor: 'toAnchor' in patch ? patch.toAnchor : current.toAnchor,
              fromEnd: 'fromEnd' in patch ? patch.fromEnd : current.fromEnd,
              toEnd: 'toEnd' in patch ? patch.toEnd : current.toEnd,
              label: 'label' in patch ? patch.label : current.label,
              color: 'color' in patch ? patch.color : current.color,
              data: 'data' in patch ? structuredClone((patch.data ?? {}) as T) : structuredClone(current.data)
            }

            edges.set(id, next)
            const cloned = cloneEdge(next)
            engine.emit('edge:updated', cloned, cloneEdge(current))
            return cloned
          }) as BoardEdge<T>
        },
        deleteEdge(id) {
          if (!edges.has(id)) {
            return
          }
          engine.runCommand('edge:delete', [id], () => {
            edges.delete(id)
            engine.emit('edge:deleted', id)
          })
        },
        getEdge(id) {
          const edge = edges.get(id)
          return edge ? cloneEdge(edge) : undefined
        },
        getEdges() {
          return Array.from(edges.values(), (edge) => cloneEdge(edge))
        },
        getEdgesFrom(id) {
          return api.getEdges().filter((edge) => edge.from === id)
        },
        getEdgesTo(id) {
          return api.getEdges().filter((edge) => edge.to === id)
        },
        getEdgesBetween(from, to) {
          return api.getEdges().filter((edge) => edge.from === from && edge.to === to)
        }
      }

      engine.extend('connections', api)
      ;(engine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting; __defaultArrow?: ConnectionPluginOptions['defaultArrow'] }).__routing =
        routing
      ;(engine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting; __defaultArrow?: ConnectionPluginOptions['defaultArrow'] }).__defaultArrow =
        defaultArrow

      const unsubscribe = engine.on('node:deleted', (id) => {
        const toDelete = Array.from(edges.values()).filter((edge) => edge.from === id || edge.to === id)
        for (const edge of toDelete) {
          edges.delete(edge.id)
          engine.emit('edge:deleted', edge.id)
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }
}
