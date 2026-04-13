import { computed, defineComponent, h, shallowRef, watch, type PropType } from 'vue'
import { type BoardEngine, type BoardNode, type NodeId, type Point } from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'
import { buildConnectionRoute, resolveConnectionEndpoint, resolveEdgeRenderState, resolveFloatingEndpoint } from './geometry'
import type {
  AnchorSide,
  BoardEdge,
  ConnectionRouting,
  ConnectionsExtension,
  ResolvedConnectionEndpoint
} from './types'

type EdgeRenderEntry = ReturnType<typeof resolveEdgeRenderState> & { edge: BoardEdge }
type DragEnd = 'from' | 'to'
type DragState = {
  edgeId: string
  end: DragEnd
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
}

let markerCounter = 0

function edgeIdFromTarget(target: EventTarget | null): string | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-connection-edge-id]')?.dataset.connectionEdgeId ?? null : null
}

function sameEdgeTarget(target: EventTarget | null, edgeId: string): boolean {
  return edgeIdFromTarget(target) === edgeId
}

function worldPointFromClient(ctx: ReturnType<typeof useBoardEngine>, engine: BoardEngine, clientX: number, clientY: number): Point {
  return engine.screenToWorld(ctx.toLocalPoint(clientX, clientY))
}

function shouldPreserveDraggedAnchor(edge: BoardEdge, end: DragEnd, nodeId: NodeId): boolean {
  return end === 'from' ? edge.from === nodeId && Boolean(edge.fromAnchor) : edge.to === nodeId && Boolean(edge.toAnchor)
}

export const BoardConnectionLayer = defineComponent({
  name: 'BoardConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<BoardEngine | null>,
      default: null
    },
    routing: {
      type: String as PropType<ConnectionRouting | undefined>,
      default: undefined
    }
  },
  setup(props, { slots }) {
    const injected = useBoardEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const version = shallowRef(0)
    const markerId = `board-connection-arrow-${markerCounter += 1}`
    const sideCache = new Map<string, { source: AnchorSide; target: AnchorSide }>()
    const hoveredEdgeId = shallowRef<string | null>(null)
    const selectedEdgeId = shallowRef<string | null>(null)
    const dragState = shallowRef<DragState | null>(null)

    let versionDirty = false
    function scheduleVersion(): void {
      if (!versionDirty) {
        versionDirty = true
        queueMicrotask(() => {
          version.value += 1
          versionDirty = false
        })
      }
    }

    watch(
      engine,
      (current, _prev, onCleanup) => {
        const unsubscribes = [
          current.on('edge:created', scheduleVersion),
          current.on('edge:updated', scheduleVersion),
          current.on('edge:deleted', scheduleVersion),
          current.$nodes.subscribe(() => scheduleVersion())
        ]
        onCleanup(() => {
          for (const unsubscribe of unsubscribes) {
            unsubscribe()
          }
        })
      },
      { immediate: true }
    )

    watch(
      () => injected.rootElement.value,
      (root, _prev, onCleanup) => {
        if (!root) {
          return
        }

        const handleRootPointerDown = (event: PointerEvent) => {
          if (dragState.value) {
            return
          }
          const target = event.target
          if (target instanceof Element && target.closest('[data-board-interactive="true"]')) {
            return
          }
          selectedEdgeId.value = null
          hoveredEdgeId.value = null
        }

        const handleRootPointerMove = (event: PointerEvent) => {
          if (dragState.value) {
            return
          }
          const edgeId = edgeIdFromTarget(event.target)
          hoveredEdgeId.value = edgeId ?? (selectedEdgeId.value ? selectedEdgeId.value : null)
        }

        const handleRootPointerLeave = () => {
          if (!dragState.value && !selectedEdgeId.value) {
            hoveredEdgeId.value = null
          }
        }

        root.addEventListener('pointerdown', handleRootPointerDown)
        root.addEventListener('pointermove', handleRootPointerMove)
        root.addEventListener('pointerleave', handleRootPointerLeave)

        onCleanup(() => {
          root.removeEventListener('pointerdown', handleRootPointerDown)
          root.removeEventListener('pointermove', handleRootPointerMove)
          root.removeEventListener('pointerleave', handleRootPointerLeave)
        })
      },
      { immediate: true }
    )

    const entries = computed<EdgeRenderEntry[]>(() => {
      void version.value
      const nodes = injected.$nodes.value
      const currentEngine = engine.value
      const routing =
        props.routing ??
        ((currentEngine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting }).__routing ?? 'bezier')
      const nextCache = new Map<string, { source: AnchorSide; target: AnchorSide }>()

      const resolved = currentEngine.ext.connections
        .getEdges()
        .map((edge) => {
          const sourceNode = nodes.get(edge.from)
          const targetNode = nodes.get(edge.to)
          if (!sourceNode || !targetNode) {
            return null
          }

          const previous = sideCache.get(String(edge.id))
          const geometry = resolveEdgeRenderState(edge, sourceNode, targetNode, {
            routing,
            previousSourceSide: previous?.source,
            previousTargetSide: previous?.target
          })

          nextCache.set(String(edge.id), {
            source: geometry.source.side,
            target: geometry.target.side
          })

          return {
            edge,
            source: geometry.source,
            target: geometry.target,
            route: geometry.route
          }
        })
        .filter((entry): entry is EdgeRenderEntry => Boolean(entry))

      sideCache.clear()
      for (const [edgeId, value] of nextCache) {
        sideCache.set(edgeId, value)
      }

      return resolved
    })

    const entryById = computed(() => new Map(entries.value.map((entry) => [String(entry.edge.id), entry] as const)))

    watch(entries, (current) => {
      const ids = new Set(current.map((entry) => String(entry.edge.id)))
      if (selectedEdgeId.value && !ids.has(selectedEdgeId.value)) {
        selectedEdgeId.value = null
      }
      if (hoveredEdgeId.value && !ids.has(hoveredEdgeId.value)) {
        hoveredEdgeId.value = null
      }
      if (dragState.value && !ids.has(dragState.value.edgeId)) {
        dragState.value = null
      }
    })

    const preview = computed(() => {
      const active = dragState.value
      if (!active) {
        return null
      }

      const entry = entryById.value.get(active.edgeId)
      if (!entry) {
        return null
      }

      const nodes = injected.$nodes.value
      const candidateNode = active.candidateNodeId ? nodes.get(active.candidateNodeId) : undefined
      const routing = entry.route.routing

      if (active.end === 'from') {
        const fixed = entry.target
        const source = candidateNode
          ? resolveConnectionEndpoint(
              {
                ...entry.edge,
                from: candidateNode.id,
                fromAnchor: shouldPreserveDraggedAnchor(entry.edge, 'from', candidateNode.id) ? entry.edge.fromAnchor : undefined
              },
              candidateNode,
              fixed.node,
              'source',
              entry.source.side
            )
          : resolveFloatingEndpoint(active.pointerWorld, fixed.point, 'source', entry.source.side)

        return {
          edge: entry.edge,
          source,
          target: fixed,
          route: buildConnectionRoute({ source, target: fixed, routing }),
          candidateNode
        }
      }

      const fixed = entry.source
      const target = candidateNode
        ? resolveConnectionEndpoint(
            {
              ...entry.edge,
              to: candidateNode.id,
              toAnchor: shouldPreserveDraggedAnchor(entry.edge, 'to', candidateNode.id) ? entry.edge.toAnchor : undefined
            },
            candidateNode,
            fixed.node,
            'target',
            entry.target.side
          )
        : resolveFloatingEndpoint(active.pointerWorld, fixed.point, 'target', entry.target.side)

      return {
        edge: entry.edge,
        source: fixed,
        target,
        route: buildConnectionRoute({ source: fixed, target, routing }),
        candidateNode
      }
    })

    const needsArrowMarker = computed(() =>
      entries.value.some((entry) => entry.edge.fromEnd === 'arrow' || entry.edge.toEnd === 'arrow')
    )

    const handleRadius = computed(() => 5 / Math.max(injected.$camera.value.z, 0.25))
    const handleHitRadius = computed(() => 11 / Math.max(injected.$camera.value.z, 0.25))
    const edgeStrokeWidth = computed(() => 2)
    const edgeHitWidth = computed(() => 18 / Math.max(injected.$camera.value.z, 0.25))
    const previewStrokeWidth = computed(() => 2.5 / Math.max(injected.$camera.value.z, 0.25))

    function onEdgePointerDown(edgeId: string, event: PointerEvent): void {
      event.preventDefault()
      event.stopPropagation()
      selectedEdgeId.value = edgeId
      hoveredEdgeId.value = edgeId
    }

    function commitReconnect(active: DragState): void {
      const entry = entryById.value.get(active.edgeId)
      if (!entry || !active.candidateNodeId) {
        return
      }

      const nodeId = active.candidateNodeId
      const connections = engine.value.ext.connections
      if (active.end === 'from') {
        if (entry.edge.from === nodeId && (!entry.edge.fromAnchor || shouldPreserveDraggedAnchor(entry.edge, 'from', nodeId))) {
          return
        }
        connections.updateEdge(entry.edge.id, {
          from: nodeId,
          fromAnchor: shouldPreserveDraggedAnchor(entry.edge, 'from', nodeId) ? entry.edge.fromAnchor : undefined
        })
        return
      }

      if (entry.edge.to === nodeId && (!entry.edge.toAnchor || shouldPreserveDraggedAnchor(entry.edge, 'to', nodeId))) {
        return
      }

      connections.updateEdge(entry.edge.id, {
        to: nodeId,
        toAnchor: shouldPreserveDraggedAnchor(entry.edge, 'to', nodeId) ? entry.edge.toAnchor : undefined
      })
    }

    function beginDrag(entry: EdgeRenderEntry, end: DragEnd, event: PointerEvent): void {
      event.preventDefault()
      event.stopPropagation()

      const currentEngine = engine.value
      const nextWorld = worldPointFromClient(injected, currentEngine, event.clientX, event.clientY)
      const candidateNode = currentEngine.getNodeAt(nextWorld)

      selectedEdgeId.value = String(entry.edge.id)
      hoveredEdgeId.value = String(entry.edge.id)
      dragState.value = {
        edgeId: String(entry.edge.id),
        end,
        pointerId: event.pointerId,
        pointerWorld: nextWorld,
        candidateNodeId: candidateNode?.id ?? null
      }
    }

    watch(dragState, (active, _prev, onCleanup) => {
      if (!active) {
        return
      }

      const handleMove = (event: PointerEvent) => {
        if (!dragState.value || event.pointerId !== dragState.value.pointerId) {
          return
        }
        const currentEngine = engine.value
        const nextWorld = worldPointFromClient(injected, currentEngine, event.clientX, event.clientY)
        const candidateNode = currentEngine.getNodeAt(nextWorld)
        dragState.value = {
          ...dragState.value,
          pointerWorld: nextWorld,
          candidateNodeId: candidateNode?.id ?? null
        }
      }

      const handleUp = (event: PointerEvent) => {
        if (!dragState.value || event.pointerId !== dragState.value.pointerId) {
          return
        }
        commitReconnect(dragState.value)
        dragState.value = null
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)

      onCleanup(() => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
      })
    })

    function renderHandle(entry: EdgeRenderEntry, end: DragEnd, endpoint: ResolvedConnectionEndpoint) {
      return h(
        'g',
        {
          'data-board-interactive': 'true',
          'data-connection-interactive': 'true',
          'data-connection-edge-id': String(entry.edge.id),
          'data-connection-handle': end,
          style: {
            pointerEvents: 'all',
            cursor: 'grab'
          },
          onPointerdown: (event: PointerEvent) => beginDrag(entry, end, event)
        },
        [
          h('circle', {
            cx: endpoint.point.x,
            cy: endpoint.point.y,
            r: handleHitRadius.value,
            fill: 'rgba(15, 23, 42, 0.001)',
            stroke: 'none'
          }),
          h('circle', {
            cx: endpoint.point.x,
            cy: endpoint.point.y,
            r: handleRadius.value,
            fill: '#ffffff',
            stroke: entry.edge.color ?? '#0f172a',
            'stroke-width': 1.5 / Math.max(injected.$camera.value.z, 0.25),
            'vector-effect': 'non-scaling-stroke'
          })
        ]
      )
    }

    function renderEdge(entry: EdgeRenderEntry) {
      const edgeId = String(entry.edge.id)
      const isSelected = selectedEdgeId.value === edgeId
      const isHovered = hoveredEdgeId.value === edgeId
      const isDragging = dragState.value?.edgeId === edgeId
      const showHandles = isSelected || isHovered || isDragging
      const stroke = entry.edge.color ?? 'currentColor'

      const visibleContent = slots.edge
        ? slots.edge(entry)
        : h('path', {
            d: entry.route.path,
            stroke,
            color: entry.edge.color ?? undefined,
            fill: 'none',
            opacity: isDragging ? 0.3 : 1,
            'stroke-width': edgeStrokeWidth.value,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke',
            'marker-start': entry.edge.fromEnd === 'arrow' ? `url(#${markerId})` : undefined,
            'marker-end': entry.edge.toEnd === 'arrow' ? `url(#${markerId})` : undefined,
            style: {
              pointerEvents: 'none'
            }
          })

      return h(
        'g',
        {
          'data-connection-edge-id': edgeId
        },
        [
          visibleContent,
          h('path', {
            d: entry.route.path,
            stroke: 'rgba(15, 23, 42, 0.001)',
            fill: 'none',
            'stroke-width': edgeHitWidth.value,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke',
            'data-board-interactive': 'true',
            'data-connection-interactive': 'true',
            'data-connection-edge-id': edgeId,
            'data-connection-hit': 'true',
            style: {
              pointerEvents: 'stroke',
              cursor: 'pointer'
            },
            onPointerdown: (event: PointerEvent) => onEdgePointerDown(edgeId, event),
            onPointerleave: (event: PointerEvent) => {
              if (!sameEdgeTarget(event.relatedTarget, edgeId) && selectedEdgeId.value !== edgeId && dragState.value?.edgeId !== edgeId) {
                hoveredEdgeId.value = null
              }
            }
          }),
          ...(showHandles ? [renderHandle(entry, 'from', entry.source), renderHandle(entry, 'to', entry.target)] : [])
        ]
      )
    }

    function renderPreview() {
      if (!preview.value) {
        return []
      }

      const previewStroke = preview.value.edge.color ?? '#0f172a'
      const candidateNode = preview.value.candidateNode
      const fixedEnd = dragState.value?.end === 'from' ? preview.value.target : preview.value.source

      return [
        candidateNode
          ? h('rect', {
              x: candidateNode.x,
              y: candidateNode.y,
              width: candidateNode.width,
              height: candidateNode.height,
              rx: 10,
              ry: 10,
              fill: 'none',
              stroke: '#0f766e',
              'stroke-width': 2 / Math.max(injected.$camera.value.z, 0.25),
              'stroke-dasharray': `${10 / Math.max(injected.$camera.value.z, 0.25)} ${6 / Math.max(injected.$camera.value.z, 0.25)}`,
              opacity: 0.85,
              style: {
                pointerEvents: 'none'
              }
            })
          : null,
        h('path', {
          d: preview.value.route.path,
          stroke: previewStroke,
          fill: 'none',
          opacity: 0.9,
          'stroke-width': previewStrokeWidth.value,
          'stroke-dasharray': `${12 / Math.max(injected.$camera.value.z, 0.25)} ${8 / Math.max(injected.$camera.value.z, 0.25)}`,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'vector-effect': 'non-scaling-stroke',
          style: {
            pointerEvents: 'none'
          }
        }),
        h('circle', {
          cx: fixedEnd.point.x,
          cy: fixedEnd.point.y,
          r: handleRadius.value,
          fill: '#ffffff',
          stroke: previewStroke,
          'stroke-width': 1.5 / Math.max(injected.$camera.value.z, 0.25),
          'vector-effect': 'non-scaling-stroke',
          style: {
            pointerEvents: 'none'
          }
        }),
        h('circle', {
          cx: dragState.value?.end === 'from' ? preview.value.source.point.x : preview.value.target.point.x,
          cy: dragState.value?.end === 'from' ? preview.value.source.point.y : preview.value.target.point.y,
          r: handleRadius.value,
          fill: '#ffffff',
          stroke: '#0f766e',
          'stroke-width': 1.5 / Math.max(injected.$camera.value.z, 0.25),
          'vector-effect': 'non-scaling-stroke',
          style: {
            pointerEvents: 'none'
          }
        })
      ]
    }

    return () =>
      h(
        'svg',
        {
          class: 'board-connection-layer',
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }
        },
        [
          needsArrowMarker.value
            ? h('defs', [
                h(
                  'marker',
                  {
                    id: markerId,
                    markerWidth: 14,
                    markerHeight: 14,
                    refX: 12,
                    refY: 7,
                    orient: 'auto-start-reverse',
                    markerUnits: 'userSpaceOnUse',
                    viewBox: '0 0 14 14'
                  },
                  [
                    h('path', {
                      d: 'M2,2 L12,7 L2,12 L5.2,7 Z',
                      fill: 'currentColor'
          })
        ]
      )
              ])
            : null,
          ...entries.value.map((entry) => renderEdge(entry)),
          ...renderPreview().filter(Boolean)
        ]
      )
  }
})
