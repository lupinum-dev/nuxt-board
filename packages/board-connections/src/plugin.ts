import {
  asEdgeId,
  BoardConflictError,
  BoardInputError,
  type BoardEventMap,
  type BoardPlugin,
  type BoardPluginApis,
  type EdgeId,
  type JsonCanvasDocument,
  type JsonCanvasEdge,
  type JsonCanvasSide,
} from '@lupinum/board-core'
import {
  defineInternalBoardPlugin,
  type InternalBoardAction,
} from '@lupinum/board-core/internal'
import type {
  BoardEdge,
  BoardEdgePatch,
  ConnectionConfig,
  ConnectionPluginOptions,
  ConnectionsExtension,
  EdgeEnd,
} from './types.js'

const CONNECTIONS_FEATURE_NAME = 'connections'

const ANCHOR_SIDES = new Set(['top', 'right', 'bottom', 'left'])

function validateAnchor(
  anchor: BoardEdge['fromAnchor'],
  field: 'fromAnchor' | 'toAnchor',
): void {
  if (!anchor) return
  if (!ANCHOR_SIDES.has(anchor.side)) {
    throw new BoardInputError(
      `Cannot use ${field}: anchor side "${String(anchor.side)}" is unsupported.`,
    )
  }
  if (
    !Number.isFinite(anchor.offset) ||
    anchor.offset < 0 ||
    anchor.offset > 1
  ) {
    throw new BoardInputError(
      `Cannot use ${field}: anchor offset must be a finite number from 0 to 1.`,
    )
  }
}

function validateEdgeColor(color: string | undefined): void {
  if (
    color !== undefined &&
    !/^[1-6]$/.test(color) &&
    !/^#[0-9a-fA-F]{6}$/.test(color)
  ) {
    throw new BoardInputError(
      `Cannot use edge color "${color}": expected a preset from 1 to 6 or a six-digit hex color.`,
    )
  }
}

interface ConnectionsState {
  readonly edges: ReadonlyMap<EdgeId, BoardEdge>
  readonly nextZIndex: number
}

type ConnectionsAction =
  | { type: 'EDGE_CREATED'; edge: BoardEdge }
  | { type: 'EDGE_UPDATED'; id: EdgeId; before: BoardEdge; after: BoardEdge }
  | { type: 'EDGE_DELETED'; id: EdgeId; edge: BoardEdge }

const initialConnectionsState: ConnectionsState = {
  edges: new Map(),
  nextZIndex: 1,
}

interface ConnectionsEventMap extends BoardEventMap {
  'edge:created': (edge: BoardEdge) => void
  'edge:updated': (edge: BoardEdge, prev: BoardEdge) => void
  'edge:deleted': (edgeId: EdgeId) => void
}

interface ConnectionsFeatureExtensions extends BoardPluginApis {
  connections: ConnectionsExtension
}

function isConnectionsAction(
  action: InternalBoardAction,
): action is InternalBoardAction & {
  type: 'FEATURE_ACTION'
  feature: typeof CONNECTIONS_FEATURE_NAME
  action: ConnectionsAction
} {
  return (
    action.type === 'FEATURE_ACTION' &&
    action.feature === CONNECTIONS_FEATURE_NAME
  )
}

function invertConnectionAction(action: ConnectionsAction): ConnectionsAction {
  switch (action.type) {
    case 'EDGE_CREATED':
      return { type: 'EDGE_DELETED', id: action.edge.id, edge: action.edge }
    case 'EDGE_DELETED':
      return { type: 'EDGE_CREATED', edge: action.edge }
    case 'EDGE_UPDATED':
      return {
        type: 'EDGE_UPDATED',
        id: action.id,
        before: action.after,
        after: action.before,
      }
  }
}

function reduceConnectionsState(
  state: ConnectionsState,
  action: InternalBoardAction,
): ConnectionsState {
  if (isConnectionsAction(action)) {
    const inner = action.action
    switch (inner.type) {
      case 'EDGE_CREATED': {
        const edges = new Map(state.edges)
        edges.set(inner.edge.id, inner.edge)
        return {
          edges,
          nextZIndex: Math.max(state.nextZIndex, inner.edge.zIndex + 1),
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
    return action.actions.reduce(reduceConnectionsState, state)
  }

  return state
}

declare module '@lupinum/board-core' {
  interface BoardEventMap {
    'edge:created': (edge: BoardEdge) => void
    'edge:updated': (edge: BoardEdge, prev: BoardEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface BoardPluginApis {
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

export function connectionsPlugin(
  options: ConnectionPluginOptions = {},
): BoardPlugin {
  const routing = options.routing ?? 'bezier'
  const endpointMode = options.endpointMode ?? 'auto'
  const defaultArrow = options.defaultArrow ?? 'end'
  const config: ConnectionConfig = {
    routing,
    endpointMode,
    defaultArrow,
  }
  const defaults = defaultEnds(defaultArrow)

  const feature = defineInternalBoardPlugin<
    ConnectionsFeatureExtensions,
    ConnectionsEventMap
  >({
    name: CONNECTIONS_FEATURE_NAME,
    slice: {
      initial: initialConnectionsState,
      reducer: reduceConnectionsState,
      invert: invertConnectionAction as (innerAction: never) => unknown,
    },
    persistence: {
      exportDocument(engine): Partial<JsonCanvasDocument> {
        const edges = engine.plugins.connections.getEdges()
        if (edges.length === 0) {
          return {}
        }
        return {
          edges: edges.map(edgeToJsonCanvas),
          'x-vue-board': {
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
        const api = engine.plugins.connections
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
          const metadata = document['x-vue-board']?.edges?.[edge.id]
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
      const getState = (): ConnectionsState =>
        engine.getFeatureState<ConnectionsState>()

      function getEdgeOrThrow(id: EdgeId, op: string): BoardEdge {
        const edge = getState().edges.get(id)
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
          return engine.runCommand(
            'edge:create',
            [input],
            () => {
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

              const state = getState()
              const id = input.id ?? asEdgeId(crypto.randomUUID())
              if (state.edges.has(id)) {
                throw new BoardConflictError(
                  `Cannot create edge: edge "${id}" already exists.`,
                )
              }
              validateAnchor(input.fromAnchor, 'fromAnchor')
              validateAnchor(input.toAnchor, 'toAnchor')
              validateEdgeColor(input.color)
              if (
                input.zIndex !== undefined &&
                !Number.isFinite(input.zIndex)
              ) {
                throw new BoardInputError(
                  'Cannot create edge: zIndex must be a finite number.',
                )
              }
              const edge: BoardEdge<T> = {
                id,
                from: input.from,
                to: input.to,
                fromAnchor: input.fromAnchor,
                toAnchor: input.toAnchor,
                fromEnd: input.fromEnd ?? defaults.fromEnd,
                toEnd: input.toEnd ?? defaults.toEnd,
                label: input.label,
                color: input.color,
                data: structuredClone(input.data ?? ({} as T)),
                zIndex: input.zIndex ?? state.nextZIndex,
              }

              engine.dispatch({
                type: 'FEATURE_ACTION',
                feature: CONNECTIONS_FEATURE_NAME,
                action: { type: 'EDGE_CREATED', edge: edge as BoardEdge },
              })
              return cloneEdge(edge)
            },
            { history: 'record' },
          ) as BoardEdge<T>
        },
        updateEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          id: EdgeId,
          patch: BoardEdgePatch<T>,
        ) {
          const current = getEdgeOrThrow(id, 'update') as BoardEdge<T>

          return engine.runCommand(
            'edge:update',
            [id, patch],
            () => {
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
              validateAnchor(
                'fromAnchor' in patch ? patch.fromAnchor : current.fromAnchor,
                'fromAnchor',
              )
              validateAnchor(
                'toAnchor' in patch ? patch.toAnchor : current.toAnchor,
                'toAnchor',
              )
              validateEdgeColor('color' in patch ? patch.color : current.color)

              const next: BoardEdge<T> = {
                ...current,
                from: nextFrom,
                to: nextTo,
                fromAnchor:
                  'fromAnchor' in patch ? patch.fromAnchor : current.fromAnchor,
                toAnchor:
                  'toAnchor' in patch ? patch.toAnchor : current.toAnchor,
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
                type: 'FEATURE_ACTION',
                feature: CONNECTIONS_FEATURE_NAME,
                action: {
                  type: 'EDGE_UPDATED',
                  id,
                  before: current as BoardEdge,
                  after: next as BoardEdge,
                },
              })
              return cloneEdge(next)
            },
            { history: 'record' },
          ) as BoardEdge<T>
        },
        deleteEdge(id) {
          const current = getState().edges.get(id)
          if (!current) return
          engine.runCommand(
            'edge:delete',
            [id],
            () => {
              engine.dispatch({
                type: 'FEATURE_ACTION',
                feature: CONNECTIONS_FEATURE_NAME,
                action: { type: 'EDGE_DELETED', id, edge: current },
              })
            },
            { history: 'record' },
          )
        },
        getEdge(id) {
          const edge = getState().edges.get(id)
          return edge ? cloneEdge(edge) : undefined
        },
        getEdges() {
          return Array.from(getState().edges.values(), (edge) =>
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
        getConfig() {
          return { ...config }
        },
      }

      engine.extend('connections', api)

      const cascadeUnsubscribe = engine.onAction((action) => {
        if (action.type !== 'NODE_DELETED') return
        const nodeId = action.node.id
        const edges = getState().edges
        for (const [id, edge] of edges) {
          if (edge.from === nodeId || edge.to === nodeId) {
            engine.dispatch({
              type: 'FEATURE_ACTION',
              feature: CONNECTIONS_FEATURE_NAME,
              action: { type: 'EDGE_DELETED', id, edge },
            })
          }
        }
      })

      let prevEdges: ReadonlyMap<EdgeId, BoardEdge> = getState().edges
      const unsubscribe = engine.onCommit(() => {
        const next = getState().edges
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
  })

  return feature
}
