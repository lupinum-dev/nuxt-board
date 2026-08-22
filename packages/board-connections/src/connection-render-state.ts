import { computed, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import {
  boundsIntersect,
  type BoardNode,
  type NodeId,
} from '@lupinum/board-core'
import type { useBoardEngine } from '@lupinum/vue-board'
import {
  buildConnectionRoute,
  resolveConnectionEndpoint,
  resolveEdgeRenderState,
  resolveFloatingEndpoint,
} from './geometry.js'
import { floatingNodeAt } from './layer-helpers.js'
import type { ConnectionDragState } from './controller.js'
import type {
  AnchorSide,
  BoardEdge,
  ConnectionEndpointMode,
  ConnectionRouting,
} from './types.js'
import type { ConnectionEngine } from './connection-engine.js'

type BoardContext = ReturnType<typeof useBoardEngine>

export type EdgeRenderEntry = ReturnType<typeof resolveEdgeRenderState> & {
  edge: BoardEdge
}

interface ConnectionRenderStateOptions {
  injected: BoardContext
  engine: ComputedRef<ConnectionEngine>
  routing: () => ConnectionRouting | undefined
  endpointMode: ComputedRef<ConnectionEndpointMode>
  selectedEdgeId: Ref<string | null>
  dragState: Ref<ConnectionDragState | null>
}

/** Own edge subscription, identity-based geometry caching, culling, and preview. */
export function useConnectionRenderState(
  options: ConnectionRenderStateOptions,
) {
  const { injected, engine, selectedEdgeId, dragState, endpointMode } = options
  const edges = shallowRef(engine.value.plugins.connections.$edges.get())
  const sideCache = new Map<
    string,
    { source: AnchorSide; target: AnchorSide }
  >()
  const geometryCache = new WeakMap<
    BoardEdge,
    {
      routing: ConnectionRouting
      sourceNode: BoardNode
      targetNode: BoardNode
      geometry: ReturnType<typeof resolveEdgeRenderState>
    }
  >()

  watch(
    engine,
    (current, _previous, onCleanup) => {
      edges.value = current.plugins.connections.$edges.get()
      onCleanup(
        current.plugins.connections.$edges.subscribe((value) => {
          edges.value = value
        }),
      )
    },
    { immediate: true },
  )

  const entries = computed<EdgeRenderEntry[]>(() => {
    const nodes = injected.$nodes.value
    const currentEngine = engine.value
    const routing =
      options.routing() ?? currentEngine.plugins.connections.getConfig().routing
    const viewport = injected.viewportSize.value
    const camera = injected.$camera.value
    const visibleBounds =
      viewport.x > 0 && viewport.y > 0
        ? currentEngine.getVisibleBounds(viewport.x, viewport.y)
        : null
    const margin = 400 / Math.max(camera.z, 0.1)
    const expandedBounds = visibleBounds
      ? {
          minX: visibleBounds.minX - margin,
          minY: visibleBounds.minY - margin,
          maxX: visibleBounds.maxX + margin,
          maxY: visibleBounds.maxY + margin,
        }
      : null
    const nextCache = new Map<
      string,
      { source: AnchorSide; target: AnchorSide }
    >()

    const resolved = Array.from(edges.value.values())
      .map((edge) => {
        const sourceNode = nodes.get(edge.from)
        const targetNode = nodes.get(edge.to)
        if (!sourceNode || !targetNode) return null

        const edgeId = String(edge.id)
        const cached = geometryCache.get(edge)
        const previous = sideCache.get(edgeId)
        const geometry =
          cached?.routing === routing &&
          cached.sourceNode === sourceNode &&
          cached.targetNode === targetNode
            ? cached.geometry
            : resolveEdgeRenderState(edge, sourceNode, targetNode, {
                routing,
                previousSourceSide: previous?.source,
                previousTargetSide: previous?.target,
              })

        geometryCache.set(edge, { routing, sourceNode, targetNode, geometry })
        nextCache.set(edgeId, {
          source: geometry.source.side,
          target: geometry.target.side,
        })

        if (
          expandedBounds &&
          selectedEdgeId.value !== edgeId &&
          !boundsIntersect(expandedBounds, geometry.route.bounds)
        ) {
          return null
        }
        return { edge, ...geometry }
      })
      .filter((entry): entry is EdgeRenderEntry => Boolean(entry))

    sideCache.clear()
    for (const [edgeId, value] of nextCache) sideCache.set(edgeId, value)
    return resolved
  })

  const entryById = computed(
    () =>
      new Map(
        entries.value.map((entry) => [String(entry.edge.id), entry] as const),
      ),
  )

  const preview = computed(() => {
    const active = dragState.value
    if (!active) return null

    const nodes = injected.$nodes.value
    const candidateNode = active.candidateNodeId
      ? nodes.get(active.candidateNodeId)
      : undefined
    const routing =
      options.routing() ?? engine.value.plugins.connections.getConfig().routing

    if (active.mode === 'reconnect') {
      const entry = entryById.value.get(active.edgeId)
      if (!entry) return null

      if (active.end === 'from') {
        const fixed = entry.target
        const source = candidateNode
          ? resolveConnectionEndpoint(
              {
                ...entry.edge,
                from: candidateNode.id,
                fromAnchor: active.candidateAnchor ?? undefined,
              },
              candidateNode,
              fixed.node,
              'source',
              active.candidateAnchor?.side ?? entry.source.side,
            )
          : resolveFloatingEndpoint(
              active.pointerWorld,
              fixed.point,
              'source',
              entry.source.side,
            )
        return {
          edge: entry.edge,
          source,
          target: fixed,
          route: buildConnectionRoute({ source, target: fixed, routing }),
          candidateNode,
        }
      }

      const fixed = entry.source
      const target = candidateNode
        ? resolveConnectionEndpoint(
            {
              ...entry.edge,
              to: candidateNode.id,
              toAnchor: active.candidateAnchor ?? undefined,
            },
            candidateNode,
            fixed.node,
            'target',
            active.candidateAnchor?.side ?? entry.target.side,
          )
        : resolveFloatingEndpoint(
            active.pointerWorld,
            fixed.point,
            'target',
            entry.target.side,
          )
      return {
        edge: entry.edge,
        source: fixed,
        target,
        route: buildConnectionRoute({ source: fixed, target, routing }),
        candidateNode,
      }
    }

    const sourceNode = nodes.get(active.sourceNodeId)
    if (!sourceNode) return null
    const previewEdge: BoardEdge = {
      id: 'preview-edge' as BoardEdge['id'],
      from: sourceNode.id,
      to: (candidateNode?.id ?? 'floating-target') as NodeId,
      fromAnchor:
        endpointMode.value === 'manual'
          ? { side: active.sourceSide, offset: 0.5 }
          : undefined,
      toAnchor:
        endpointMode.value === 'manual' && active.candidateAnchor
          ? active.candidateAnchor
          : undefined,
      data: {},
      zIndex: 0,
    }
    const targetReference =
      candidateNode ?? floatingNodeAt(active.pointerWorld, 'target')
    const source = resolveConnectionEndpoint(
      previewEdge,
      sourceNode,
      targetReference,
      'source',
      active.sourceSide,
    )
    const target = candidateNode
      ? resolveConnectionEndpoint(
          previewEdge,
          candidateNode,
          sourceNode,
          'target',
        )
      : resolveFloatingEndpoint(active.pointerWorld, source.point, 'target')
    return {
      edge: null,
      source,
      target,
      route: buildConnectionRoute({ source, target, routing }),
      candidateNode,
    }
  })

  return { entries, entryById, preview }
}
