import {
  asEdgeId,
  type BoardPlugin,
  type EdgeId,
  type JsonCanvasDocument,
  type JsonCanvasEdge,
  type JsonCanvasSide,
  type NodeId,
} from '@lupinum/board-core'
import {
  SLICE_NAME,
  initialState,
  invert,
  reducer,
  type ConnectionsSliceState,
} from './slice'
import type {
  BoardEdge,
  BoardEdgePatch,
  ConnectionPluginOptions,
  ConnectionEndpointMode,
  ConnectionRouting,
  ConnectionsExtension,
  EdgeEnd,
} from './types'

declare module '@lupinum/board-core' {
  interface BoardEventMap {
    'edge:created': (edge: BoardEdge) => void
    'edge:updated': (edge: BoardEdge, prev: BoardEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface BoardEngineExtensions {
    connections: ConnectionsExtension
  }
}

function defaultEnds(
  defaultArrow: NonNullable<ConnectionPluginOptions['defaultArrow']>,
): {
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
    data: structuredClone(edge.data),
  }
}

function edgeToJsonCanvas(edge: BoardEdge): JsonCanvasEdge {
  return {
    id: edge.id,
    fromNode: edge.from,
    ...(edge.fromAnchor?.side
      ? { fromSide: edge.fromAnchor.side as JsonCanvasSide }
      : {}),
    ...(edge.fromEnd ? { fromEnd: edge.fromEnd } : {}),
    toNode: edge.to,
    ...(edge.toAnchor?.side
      ? { toSide: edge.toAnchor.side as JsonCanvasSide }
      : {}),
    ...(edge.toEnd ? { toEnd: edge.toEnd } : {}),
    ...(edge.color ? { color: edge.color as JsonCanvasEdge['color'] } : {}),
    ...(edge.label ? { label: edge.label } : {}),
  }
}

export function connectionPlugin(
  options: ConnectionPluginOptions = {},
): BoardPlugin {
  const routing = options.routing ?? 'bezier'
  const endpointMode = options.endpointMode ?? 'auto'
  const defaultArrow = options.defaultArrow ?? 'end'
  const defaults = defaultEnds(defaultArrow)

  return {
    name: SLICE_NAME,
    slice: {
      initial: initialState,
      reducer,
      invert: invert as (innerAction: never) => unknown,
    },
    persistence: {
      exportDocument(engine): Partial<JsonCanvasDocument> {
        const edges = engine.ext.connections.getEdges()
        if (edges.length === 0) {
          return {}
        }
        return {
          edges: edges.map(edgeToJsonCanvas),
          'x-nuxt-board': {
            edges: Object.fromEntries(
              edges.map((edge) => [
                edge.id,
                {
                  zIndex: edge.zIndex,
                  ...(Object.keys(edge.data).length > 0
                    ? { data: edge.data }
                    : {}),
                },
              ]),
            ),
          },
        }
      },
      importDocument(engine, document, mode, idMap): void {
        const api = engine.ext.connections
        if (mode === 'replace') {
          for (const edge of api.getEdges()) {
            api.deleteEdge(edge.id)
          }
        }

        for (const edge of document.edges ?? []) {
          const from = idMap.get(edge.fromNode) ?? edge.fromNode
          const to = idMap.get(edge.toNode) ?? edge.toNode
          if (!engine.hasNode(from) || !engine.hasNode(to)) {
            continue
          }
          const metadata = document['x-nuxt-board']?.edges?.[edge.id]
          const id =
            mode === 'merge' && api.getEdge(edge.id)
              ? asEdgeId(crypto.randomUUID())
              : edge.id
          api.createEdge({
            id,
            from,
            to,
            ...(edge.fromSide
              ? { fromAnchor: { side: edge.fromSide, offset: 0.5 } }
              : {}),
            ...(edge.toSide
              ? { toAnchor: { side: edge.toSide, offset: 0.5 } }
              : {}),
            ...(edge.fromEnd ? { fromEnd: edge.fromEnd } : {}),
            ...(edge.toEnd ? { toEnd: edge.toEnd } : {}),
            ...(edge.color ? { color: edge.color } : {}),
            ...(edge.label ? { label: edge.label } : {}),
            data: metadata?.data ?? {},
            ...(metadata?.zIndex !== undefined
              ? { zIndex: metadata.zIndex }
              : {}),
          })
        }
      },
    },
    install(engine) {
      const getSlice = (): ConnectionsSliceState =>
        engine.getPluginState<ConnectionsSliceState>()

      function getEdgeOrThrow(id: EdgeId, op: string): BoardEdge {
        const edge = getSlice().edges.get(id)
        if (!edge) {
          throw new Error(`Cannot ${op} edge: edge "${id}" does not exist.`)
        }
        return edge
      }

      const api: ConnectionsExtension = {
        createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & {
            id?: EdgeId
            zIndex?: number
          },
        ) {
          return engine.runCommand('edge:create', [input], () => {
            if (!engine.hasNode(input.from)) {
              throw new Error(
                `Cannot create edge: source node "${input.from}" does not exist.`,
              )
            }
            if (!engine.hasNode(input.to)) {
              throw new Error(
                `Cannot create edge: target node "${input.to}" does not exist.`,
              )
            }

            const slice = getSlice()
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
              zIndex: input.zIndex ?? slice.nextZIndex,
            }

            engine.dispatch({
              type: 'PLUGIN',
              plugin: SLICE_NAME,
              action: { type: 'EDGE_CREATED', edge: edge as BoardEdge },
            })
            return cloneEdge(edge)
          }) as BoardEdge<T>
        },
        updateEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          id: EdgeId,
          patch: BoardEdgePatch<T>,
        ) {
          const current = getEdgeOrThrow(id, 'update') as BoardEdge<T>

          return engine.runCommand('edge:update', [id, patch], () => {
            const nextFrom = 'from' in patch ? patch.from : current.from
            const nextTo = 'to' in patch ? patch.to : current.to
            if (!nextFrom || !engine.hasNode(nextFrom)) {
              throw new Error(
                `Cannot update edge: source node "${nextFrom}" does not exist.`,
              )
            }
            if (!nextTo || !engine.hasNode(nextTo)) {
              throw new Error(
                `Cannot update edge: target node "${nextTo}" does not exist.`,
              )
            }

            const next: BoardEdge<T> = {
              ...current,
              from: nextFrom,
              to: nextTo,
              fromAnchor:
                'fromAnchor' in patch ? patch.fromAnchor : current.fromAnchor,
              toAnchor: 'toAnchor' in patch ? patch.toAnchor : current.toAnchor,
              fromEnd: 'fromEnd' in patch ? patch.fromEnd : current.fromEnd,
              toEnd: 'toEnd' in patch ? patch.toEnd : current.toEnd,
              label: 'label' in patch ? patch.label : current.label,
              color: 'color' in patch ? patch.color : current.color,
              data:
                'data' in patch
                  ? structuredClone((patch.data ?? {}) as T)
                  : structuredClone(current.data),
            }

            engine.dispatch({
              type: 'PLUGIN',
              plugin: SLICE_NAME,
              action: {
                type: 'EDGE_UPDATED',
                id,
                before: current as BoardEdge,
                after: next as BoardEdge,
              },
            })
            return cloneEdge(next)
          }) as BoardEdge<T>
        },
        deleteEdge(id) {
          const current = getSlice().edges.get(id)
          if (!current) return
          engine.runCommand('edge:delete', [id], () => {
            engine.dispatch({
              type: 'PLUGIN',
              plugin: SLICE_NAME,
              action: { type: 'EDGE_DELETED', id, edge: current },
            })
          })
        },
        getEdge(id) {
          const edge = getSlice().edges.get(id)
          return edge ? cloneEdge(edge) : undefined
        },
        getEdges() {
          return Array.from(getSlice().edges.values(), (edge) =>
            cloneEdge(edge),
          )
        },
        getEdgesFrom(id) {
          return api.getEdges().filter((edge) => edge.from === id)
        },
        getEdgesTo(id) {
          return api.getEdges().filter((edge) => edge.to === id)
        },
        getEdgesBetween(from, to) {
          return api
            .getEdges()
            .filter((edge) => edge.from === from && edge.to === to)
        },
      }

      engine.extend('connections', api)
      ;(
        engine.ext.connections as ConnectionsExtension & {
          __routing?: ConnectionRouting
          __endpointMode?: ConnectionEndpointMode
          __defaultArrow?: ConnectionPluginOptions['defaultArrow']
        }
      ).__routing = routing
      ;(
        engine.ext.connections as ConnectionsExtension & {
          __routing?: ConnectionRouting
          __endpointMode?: ConnectionEndpointMode
          __defaultArrow?: ConnectionPluginOptions['defaultArrow']
        }
      ).__endpointMode = endpointMode
      ;(
        engine.ext.connections as ConnectionsExtension & {
          __routing?: ConnectionRouting
          __endpointMode?: ConnectionEndpointMode
          __defaultArrow?: ConnectionPluginOptions['defaultArrow']
        }
      ).__defaultArrow = defaultArrow

      const cascadeUnsubscribe = engine.onAction((action) => {
        if (action.type !== 'NODE_DELETED') return
        const nodeId = action.node.id
        const edges = getSlice().edges
        for (const [id, edge] of edges) {
          if (edge.from === nodeId || edge.to === nodeId) {
            engine.dispatch({
              type: 'PLUGIN',
              plugin: SLICE_NAME,
              action: { type: 'EDGE_DELETED', id, edge },
            })
          }
        }
      })

      let prevEdges: ReadonlyMap<EdgeId, BoardEdge> = getSlice().edges
      const unsubscribe = engine.onAction(() => {
        const next = getSlice().edges
        if (next === prevEdges) return
        for (const [id, edge] of next) {
          const before = prevEdges.get(id)
          if (!before) {
            engine.emit('edge:created', cloneEdge(edge))
          } else if (before !== edge) {
            engine.emit('edge:updated', cloneEdge(edge), cloneEdge(before))
          }
        }
        for (const [id] of prevEdges) {
          if (!next.has(id)) {
            engine.emit('edge:deleted', id)
          }
        }
        prevEdges = next
      })

      return () => {
        cascadeUnsubscribe()
        unsubscribe()
      }
    },
  }
}
