import {
  asEdgeId,
  asNodeId,
  BoardConflictError,
  BoardInputError,
  BoardNotFoundError,
  type BoardPlugin,
  type BoardPluginApis,
  type EdgeId,
  type JsonObject,
  type JsonCanvasDocument,
  type JsonCanvasEdge,
  type JsonCanvasSide,
} from '@lupinum/board-core'
import {
  collectJsonObjectExtras,
  defineInternalBoardPlugin,
  freezeJsonObject,
  readonlyMapView,
} from '@lupinum/board-core/internal'
import { edgeEndsForDirectionality } from './directionality.js'
import type {
  BoardEdge,
  BoardEdgeInput,
  BoardEdgePatch,
  ConnectionConfig,
  ConnectionPluginOptions,
  ConnectionsApi,
  ConnectionsEventMap,
} from './types.js'

const CONNECTIONS_FEATURE_NAME = 'connections'

const ANCHOR_SIDES = new Set(['top', 'right', 'bottom', 'left'])
const JSON_CANVAS_EDGE_FIELDS = new Set([
  'id',
  'fromNode',
  'fromSide',
  'fromEnd',
  'toNode',
  'toSide',
  'toEnd',
  'color',
  'label',
])

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
  | { type: 'EDGE_UPDATED'; id: EdgeId; after: BoardEdge }
  | { type: 'EDGE_DELETED'; id: EdgeId }

interface ConnectionsPluginApis extends BoardPluginApis {
  connections: ConnectionsApi
}

const initialConnectionsState: ConnectionsState = {
  edges: new Map(),
  nextZIndex: 1,
}

function reduceConnectionsState(
  state: ConnectionsState,
  action: ConnectionsAction,
  reusableEdges?: Map<EdgeId, BoardEdge>,
): ConnectionsState {
  switch (action.type) {
    case 'EDGE_CREATED': {
      const edges = reusableEdges ?? new Map(state.edges)
      edges.set(action.edge.id, action.edge)
      return {
        ...state,
        edges,
        nextZIndex: Math.max(state.nextZIndex, action.edge.zIndex + 1),
      }
    }
    case 'EDGE_UPDATED': {
      const edges = reusableEdges ?? new Map(state.edges)
      edges.set(action.id, action.after)
      return { ...state, edges }
    }
    case 'EDGE_DELETED': {
      if (!state.edges.has(action.id)) return state
      const edges = reusableEdges ?? new Map(state.edges)
      edges.delete(action.id)
      return { ...state, edges }
    }
  }
}

function freezeAnchor(
  anchor: BoardEdge['fromAnchor'],
): BoardEdge['fromAnchor'] {
  return anchor ? Object.freeze({ ...anchor }) : undefined
}

function freezeEdge<T extends JsonObject>(edge: BoardEdge<T>): BoardEdge<T> {
  return Object.freeze(edge)
}

function sameAnchor(
  first: BoardEdge['fromAnchor'],
  second: BoardEdge['fromAnchor'],
): boolean {
  return (
    first === second ||
    (first?.side === second?.side && first?.offset === second?.offset)
  )
}

function edgeToJsonCanvas(
  edge: BoardEdge,
  extras: JsonObject | undefined,
): JsonCanvasEdge {
  return {
    ...(extras ?? {}),
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
): BoardPlugin<ConnectionsPluginApis, ConnectionsEventMap> {
  const routing = options.routing ?? 'bezier'
  const endpointMode = options.endpointMode ?? 'auto'
  const defaultArrow = options.defaultArrow ?? 'end'
  const config: ConnectionConfig = {
    routing,
    endpointMode,
    defaultArrow,
  }
  const defaults = edgeEndsForDirectionality(defaultArrow)
  const edgeExtras = new WeakMap<BoardEdge, JsonObject>()

  const plugin = defineInternalBoardPlugin<
    ConnectionsPluginApis,
    ConnectionsEventMap,
    ConnectionsState
  >({
    name: CONNECTIONS_FEATURE_NAME,
    slice: {
      initial: initialConnectionsState,
    },
    nodeDeleted(engine, nodeId) {
      engine.updatePluginState((state) => {
        const edges = new Map(state.edges)
        for (const [id, edge] of edges) {
          if (edge.from === nodeId || edge.to === nodeId) {
            edges.delete(id)
          }
        }
        return edges.size === state.edges.size ? state : { ...state, edges }
      })
    },
    persistence: {
      exportDocument(engine): Partial<JsonCanvasDocument> {
        const edges = engine.plugins.connections.getEdges()
        if (edges.length === 0) {
          return {}
        }
        return {
          edges: edges.map((edge) =>
            edgeToJsonCanvas(edge, edgeExtras.get(edge)),
          ),
          'x-lupinum-board': {
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
      loadDocument(engine, document, mode, idMap): void {
        const api = engine.plugins.connections
        if (mode === 'replace') {
          for (const edge of api.getEdges()) {
            api.deleteEdge(edge.id)
          }
        }

        for (const edge of document.edges ?? []) {
          const sourceId = asNodeId(edge.fromNode)
          const targetId = asNodeId(edge.toNode)
          const from = idMap.get(sourceId) ?? sourceId
          const to = idMap.get(targetId) ?? targetId
          if (!engine.hasNode(from) || !engine.hasNode(to)) {
            continue
          }
          const metadata = document['x-lupinum-board']?.edges?.[edge.id]
          const id =
            mode === 'merge' && api.getEdge(asEdgeId(edge.id))
              ? asEdgeId(crypto.randomUUID())
              : asEdgeId(edge.id)
          const created = api.createEdge({
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
          const extras = collectJsonObjectExtras(
            edge as unknown as Readonly<Record<string, unknown>>,
            JSON_CANVAS_EDGE_FIELDS,
            `Invalid board document: edge "${edge.id}"`,
          )
          if (Object.keys(extras).length > 0) {
            edgeExtras.set(created, extras)
          }
        }
      },
    },
    install(engine) {
      const getState = (): ConnectionsState => engine.getPluginState()
      let batchEdges: Map<EdgeId, BoardEdge> | null = null
      const applyAction = (action: ConnectionsAction): ConnectionsState =>
        engine.updatePluginState((state: ConnectionsState) => {
          if (!engine.isBatching()) {
            batchEdges = null
            return reduceConnectionsState(state, action)
          }
          if (state.edges !== batchEdges) {
            batchEdges = new Map(state.edges)
          }
          return reduceConnectionsState(state, action, batchEdges)
        })

      function getEdgeOrThrow(id: EdgeId, op: string): BoardEdge {
        const edge = getState().edges.get(id)
        if (!edge) {
          throw new BoardNotFoundError(
            `Cannot ${op} edge: edge "${id}" does not exist.`,
          )
        }
        return edge
      }

      let publicEdgeSource = getState().edges
      let publicEdges = readonlyMapView(publicEdgeSource)
      const $edges = engine.createCommitSubscribable(() => {
        const next = getState().edges
        if (next !== publicEdgeSource) {
          publicEdgeSource = next
          publicEdges = readonlyMapView(next)
        }
        return publicEdges
      }, 'connections.$edges')

      const api: ConnectionsApi = {
        $edges,
        createEdge<T extends JsonObject = JsonObject>(
          input: BoardEdgeInput<T>,
        ) {
          return engine.runCommand(
            'edge:create',
            [input],
            () => {
              if (!engine.hasNode(input.from)) {
                throw new BoardNotFoundError(
                  `Cannot create edge: source node "${input.from}" does not exist.`,
                )
              }
              if (!engine.hasNode(input.to)) {
                throw new BoardNotFoundError(
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
              const edge = freezeEdge({
                id,
                from: input.from,
                to: input.to,
                fromAnchor: freezeAnchor(input.fromAnchor),
                toAnchor: freezeAnchor(input.toAnchor),
                fromEnd: input.fromEnd ?? defaults.fromEnd,
                toEnd: input.toEnd ?? defaults.toEnd,
                label: input.label,
                color: input.color,
                data: freezeJsonObject(input.data ?? {}, 'edge data') as T,
                zIndex: input.zIndex ?? state.nextZIndex,
              })

              applyAction({ type: 'EDGE_CREATED', edge: edge as BoardEdge })
              return edge
            },
            { history: 'record' },
          ) as BoardEdge<T>
        },
        updateEdge(id: EdgeId, patch: BoardEdgePatch) {
          const current = getEdgeOrThrow(id, 'update')

          return engine.runCommand(
            'edge:update',
            [id, patch],
            () => {
              const nextFrom = 'from' in patch ? patch.from : current.from
              const nextTo = 'to' in patch ? patch.to : current.to
              if (!nextFrom || !engine.hasNode(nextFrom)) {
                throw new BoardNotFoundError(
                  `Cannot update edge: source node "${nextFrom}" does not exist.`,
                )
              }
              if (!nextTo || !engine.hasNode(nextTo)) {
                throw new BoardNotFoundError(
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

              const nextFromAnchor =
                'fromAnchor' in patch
                  ? sameAnchor(patch.fromAnchor, current.fromAnchor)
                    ? current.fromAnchor
                    : freezeAnchor(patch.fromAnchor)
                  : current.fromAnchor
              const nextToAnchor =
                'toAnchor' in patch
                  ? sameAnchor(patch.toAnchor, current.toAnchor)
                    ? current.toAnchor
                    : freezeAnchor(patch.toAnchor)
                  : current.toAnchor
              const nextData =
                'data' in patch
                  ? patch.data === current.data
                    ? current.data
                    : freezeJsonObject(patch.data ?? {}, 'edge data')
                  : current.data
              const next = freezeEdge({
                ...current,
                from: nextFrom,
                to: nextTo,
                fromAnchor: nextFromAnchor,
                toAnchor: nextToAnchor,
                fromEnd: 'fromEnd' in patch ? patch.fromEnd : current.fromEnd,
                toEnd: 'toEnd' in patch ? patch.toEnd : current.toEnd,
                label: 'label' in patch ? patch.label : current.label,
                color: 'color' in patch ? patch.color : current.color,
                data: nextData,
              })

              if (
                next.from === current.from &&
                next.to === current.to &&
                next.fromAnchor === current.fromAnchor &&
                next.toAnchor === current.toAnchor &&
                next.fromEnd === current.fromEnd &&
                next.toEnd === current.toEnd &&
                next.label === current.label &&
                next.color === current.color &&
                next.data === current.data
              ) {
                return current
              }

              applyAction({
                type: 'EDGE_UPDATED',
                id,
                after: next,
              })
              const extras = edgeExtras.get(current)
              if (extras) edgeExtras.set(next, extras)
              return next
            },
            { history: 'record' },
          )
        },
        deleteEdge(id) {
          const current = getState().edges.get(id)
          if (!current) return
          engine.runCommand(
            'edge:delete',
            [id],
            () => {
              applyAction({ type: 'EDGE_DELETED', id })
            },
            { history: 'record' },
          )
        },
        getEdge(id) {
          return getState().edges.get(id)
        },
        getEdges() {
          return Array.from(getState().edges.values())
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
          engine.assertActive()
          return { ...config }
        },
      }

      engine.extend('connections', api)

      let prevEdges: ReadonlyMap<EdgeId, BoardEdge> = getState().edges
      const unsubscribe = engine.projectCommit(() => {
        const next = getState().edges
        if (next === prevEdges) return () => undefined
        const beforeEdges = prevEdges
        return () => {
          batchEdges = null
          prevEdges = next
          for (const [id, edge] of next) {
            const before = beforeEdges.get(id)
            if (!before) {
              engine.emit('edge:created', edge)
            } else if (before !== edge) {
              engine.emit('edge:updated', edge, before)
            }
          }
          for (const [id] of beforeEdges) {
            if (!next.has(id)) {
              engine.emit('edge:deleted', id)
            }
          }
        }
      })

      return unsubscribe
    },
  })

  return plugin
}
