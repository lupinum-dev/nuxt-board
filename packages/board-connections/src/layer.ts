import {
  Teleport,
  computed,
  defineComponent,
  h,
  shallowRef,
  useId,
  watch,
  type PropType,
} from 'vue'
import {
  boundsIntersect,
  type BoardEngine,
  type BoardNode,
  type NodeId,
} from '@lupinum/board-core'
import { BOARD_INTERACTIVE_SELECTOR } from '@lupinum/board-core/internal'
import { useBoardEngine } from '@lupinum/vue-board'
import {
  buildConnectionRoute,
  resolveAnchorPoint,
  resolveConnectionEndpoint,
  resolveEdgeRenderState,
  resolveFloatingEndpoint,
} from './geometry.js'
import type {
  AnchorPosition,
  AnchorSide,
  BoardEdge,
  ConnectionEndpointMode,
  ConnectionsApi,
  CreateNodeForConnectionContext,
  ConnectionRouting,
  ConnectionsEventMap,
  ResolvedConnectionEndpoint,
} from './types.js'

import {
  CONNECTION_DRAG_THRESHOLD,
  EDGE_ARROW_MARKER_SIZE,
  EDGE_STROKE_LOD_FADE_START,
  EDGE_STROKE_LOD_SOFTEN_AT,
  floatingNodeAt,
  resolveArrowScreenSize,
  resolveLodAmount,
  worldPointFromClient,
} from './layer-helpers.js'
import {
  edgeIdFromTarget,
  nodeHandleFromTarget,
  resolveNodeHandleAtWorldPoint,
  sameEdgeTarget,
  type ConnectionNodeHandle,
} from './hit-testing.js'
import {
  advanceConnectionDrag,
  type ConnectionDragState,
  type DragEnd,
  type PendingConnectionDrag,
} from './controller.js'
import { renderConnectionPreview, renderDefaultEdgePath } from './renderer.js'
import { ConnectionLabel } from './connection-label.js'
import { renderConnectionToolbar } from './connection-toolbar.js'
import { createConnectionActions } from './connection-actions.js'

type EdgeRenderEntry = ReturnType<typeof resolveEdgeRenderState> & {
  edge: BoardEdge
}

export const BoardConnectionLayer = defineComponent({
  name: 'BoardConnectionLayer',
  props: {
    routing: {
      type: String as PropType<ConnectionRouting | undefined>,
      default: undefined,
    },
    endpointMode: {
      type: String as PropType<ConnectionEndpointMode | undefined>,
      default: undefined,
    },
    createNodeForConnection: {
      type: Function as PropType<
        (context: CreateNodeForConnectionContext) => BoardNode | null
      >,
      default: null,
    },
  },
  setup(props, { slots }) {
    const injected = useBoardEngine()
    const engine = computed(
      () =>
        injected.engine as BoardEngine<
          { connections: ConnectionsApi },
          ConnectionsEventMap
        >,
    )
    const edges = shallowRef(engine.value.plugins.connections.$edges.get())
    const markerId = `board-connection-arrow-${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`
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
    const hoveredEdgeId = shallowRef<string | null>(null)
    const hoveredNodeId = shallowRef<NodeId | null>(null)
    const hoveredNodeHandle = shallowRef<ConnectionNodeHandle | null>(null)
    const selectedEdgeId = shallowRef<string | null>(null)
    const pendingDrag = shallowRef<PendingConnectionDrag | null>(null)
    const dragState = shallowRef<ConnectionDragState | null>(null)
    const editingEdgeId = shallowRef<string | null>(null)
    const labelDraft = shallowRef<string>('')
    const colorMenuEdgeId = shallowRef<string | null>(null)
    const directionMenuEdgeId = shallowRef<string | null>(null)
    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches

    watch(
      engine,
      (current, _prev, onCleanup) => {
        edges.value = current.plugins.connections.$edges.get()
        const unsubscribe = current.plugins.connections.$edges.subscribe(
          (value) => {
            edges.value = value
          },
        )
        onCleanup(unsubscribe)
      },
      { immediate: true },
    )

    watch(
      () => injected.rootElement.value,
      (root, _prev, onCleanup) => {
        if (!root) {
          return
        }

        const handleRootPointerDown = (event: PointerEvent) => {
          if (dragState.value || pendingDrag.value) {
            return
          }
          const target = event.target
          if (
            target instanceof Element &&
            target.closest(BOARD_INTERACTIVE_SELECTOR)
          ) {
            return
          }
          selectedEdgeId.value = null
          hoveredEdgeId.value = null
          hoveredNodeHandle.value = null
          colorMenuEdgeId.value = null
          directionMenuEdgeId.value = null
          commitLabelEdit()
        }

        const handleRootPointerMove = (event: PointerEvent) => {
          if (dragState.value || pendingDrag.value) {
            return
          }
          const edgeId = edgeIdFromTarget(event.target)
          const currentEngine = engine.value
          const worldPoint = worldPointFromClient(
            injected,
            currentEngine,
            event.clientX,
            event.clientY,
          )
          const nodeUnderCursor = currentEngine.getNodeAt(worldPoint)
          const nodeHandle =
            nodeHandleFromTarget(event.target) ??
            resolveNodeHandleAtWorldPoint(
              injected.$nodes.value.values(),
              worldPoint,
              hotspotThickness.value,
              hotspotCornerClearance.value,
            )

          hoveredEdgeId.value =
            edgeId ?? (selectedEdgeId.value ? selectedEdgeId.value : null)
          hoveredNodeHandle.value = edgeId ? null : nodeHandle
          hoveredNodeId.value = nodeUnderCursor?.id ?? null
        }

        const handleRootPointerLeave = () => {
          if (!dragState.value && !pendingDrag.value && !selectedEdgeId.value) {
            hoveredEdgeId.value = null
            hoveredNodeHandle.value = null
          }
          hoveredNodeId.value = null
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
      { immediate: true },
    )

    const entries = computed<EdgeRenderEntry[]>(() => {
      const nodes = injected.$nodes.value
      const currentEngine = engine.value
      const routing =
        props.routing ?? currentEngine.plugins.connections.getConfig().routing
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

      const edgeRecords = Array.from(edges.value.values())
      const resolved = edgeRecords
        .map((edge) => {
          const sourceNode = nodes.get(edge.from)
          const targetNode = nodes.get(edge.to)
          if (!sourceNode || !targetNode) {
            return null
          }

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

          geometryCache.set(edge, {
            routing,
            sourceNode,
            targetNode,
            geometry,
          })

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

          return {
            edge,
            source: geometry.source,
            target: geometry.target,
            route: geometry.route,
          }
        })
        .filter((entry): entry is EdgeRenderEntry => Boolean(entry))

      sideCache.clear()
      for (const [edgeId, value] of nextCache) {
        sideCache.set(edgeId, value)
      }
      return resolved
    })

    const entryById = computed(
      () =>
        new Map(
          entries.value.map((entry) => [String(entry.edge.id), entry] as const),
        ),
    )

    const endpointMode = computed<ConnectionEndpointMode>(
      () =>
        props.endpointMode ??
        engine.value.plugins.connections.getConfig().endpointMode,
    )

    const {
      onEdgePointerDown,
      beginLabelEdit,
      commitLabelEdit,
      clearLabel,
      cancelLabelEdit,
      setDirectionality,
      applyEdgeColor,
      resetEndpointAnchor,
      deleteEdge,
      commitDrag,
    } = createConnectionActions({
      getEngine: () => engine.value,
      getEntry: (edgeId) => entryById.value.get(edgeId),
      getRootElement: () => injected.rootElement.value,
      getEndpointMode: () => endpointMode.value,
      createNodeForConnection: () => props.createNodeForConnection,
      state: {
        hoveredEdgeId,
        hoveredNodeHandle,
        selectedEdgeId,
        editingEdgeId,
        labelDraft,
        colorMenuEdgeId,
        directionMenuEdgeId,
      },
    })

    watch(entries, (current) => {
      const ids = new Set(current.map((entry) => String(entry.edge.id)))
      if (selectedEdgeId.value && !ids.has(selectedEdgeId.value)) {
        selectedEdgeId.value = null
      }
      if (hoveredEdgeId.value && !ids.has(hoveredEdgeId.value)) {
        hoveredEdgeId.value = null
      }
      if (
        pendingDrag.value?.mode === 'reconnect' &&
        !ids.has(pendingDrag.value.edgeId)
      ) {
        pendingDrag.value = null
      }
      if (
        dragState.value?.mode === 'reconnect' &&
        !ids.has(dragState.value.edgeId)
      ) {
        dragState.value = null
      }
    })

    const preview = computed(() => {
      const active = dragState.value
      if (!active) {
        return null
      }

      const nodes = injected.$nodes.value
      const candidateNode = active.candidateNodeId
        ? nodes.get(active.candidateNodeId)
        : undefined
      const routing =
        props.routing ?? engine.value.plugins.connections.getConfig().routing

      if (active.mode === 'reconnect') {
        const entry = entryById.value.get(active.edgeId)
        if (!entry) {
          return null
        }

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
      if (!sourceNode) {
        return null
      }

      const lockedSourceAnchor =
        endpointMode.value === 'manual'
          ? { side: active.sourceSide, offset: 0.5 }
          : undefined
      const lockedTargetAnchor =
        endpointMode.value === 'manual' && active.candidateAnchor
          ? active.candidateAnchor
          : undefined
      const previewEdge: BoardEdge = {
        id: 'preview-edge' as BoardEdge['id'],
        from: sourceNode.id,
        to: (candidateNode?.id ?? 'floating-target') as NodeId,
        fromAnchor: lockedSourceAnchor,
        toAnchor: lockedTargetAnchor,
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

    const handleRadius = computed(
      () => 5 / Math.max(injected.$camera.value.z, 0.25),
    )
    const handleHitRadius = computed(() =>
      Math.max(
        10,
        (coarsePointer ? 22 : 12) / Math.max(injected.$camera.value.z, 0.25),
      ),
    )
    const edgeStrokeWidth = computed(() => 1.85)
    const edgeHitWidth = computed(() =>
      Math.max(16, 20 / Math.max(injected.$camera.value.z, 0.25)),
    )
    const previewStrokeWidth = computed(
      () => 2.5 / Math.max(injected.$camera.value.z, 0.25),
    )
    const hotspotThickness = computed(() =>
      Math.max(18, 22 / Math.max(injected.$camera.value.z, 0.25)),
    )
    const hotspotCornerClearance = computed(
      () => 18 / Math.max(injected.$camera.value.z, 0.25),
    )

    function beginReconnectDrag(
      entry: EdgeRenderEntry,
      end: DragEnd,
      event: PointerEvent,
    ): void {
      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as Element | null)?.setPointerCapture?.(
        event.pointerId,
      )

      const currentEngine = engine.value
      const nextWorld = worldPointFromClient(
        injected,
        currentEngine,
        event.clientX,
        event.clientY,
      )
      selectedEdgeId.value = String(entry.edge.id)
      hoveredEdgeId.value = String(entry.edge.id)
      hoveredNodeHandle.value = null
      pendingDrag.value = {
        mode: 'reconnect',
        edgeId: String(entry.edge.id),
        end,
        pointerId: event.pointerId,
        startWorld: nextWorld,
      }
    }

    function beginCreateDrag(
      nodeId: NodeId,
      side: AnchorSide,
      event: PointerEvent,
    ): void {
      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as Element | null)?.setPointerCapture?.(
        event.pointerId,
      )

      const currentEngine = engine.value
      const nextWorld = worldPointFromClient(
        injected,
        currentEngine,
        event.clientX,
        event.clientY,
      )
      hoveredEdgeId.value = null
      selectedEdgeId.value = null
      hoveredNodeHandle.value = { nodeId, side, offset: 0.5 }
      pendingDrag.value = {
        mode: 'create',
        sourceNodeId: nodeId,
        sourceSide: side,
        pointerId: event.pointerId,
        startWorld: nextWorld,
      }
    }

    watch(
      [selectedEdgeId, () => injected.rootElement.value],
      (_next, _prev, onCleanup) => {
        if (!selectedEdgeId.value) {
          return
        }
        const root = injected.rootElement.value
        if (!root) return
        const handleKey = (event: KeyboardEvent) => {
          const id = selectedEdgeId.value
          if (!id) {
            return
          }
          if (editingEdgeId.value) {
            return
          }
          const target = event.target
          if (target instanceof HTMLElement) {
            const tag = target.tagName
            if (
              tag === 'INPUT' ||
              tag === 'TEXTAREA' ||
              target.isContentEditable
            ) {
              return
            }
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            deleteEdge(id)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            colorMenuEdgeId.value = null
            directionMenuEdgeId.value = null
            selectedEdgeId.value = null
            hoveredEdgeId.value = null
          }
        }
        root.addEventListener('keydown', handleKey)
        onCleanup(() => {
          root.removeEventListener('keydown', handleKey)
        })
      },
    )

    watch([pendingDrag, dragState], ([pending, active], _prev, onCleanup) => {
      if (!pending && !active) {
        return
      }

      const handleMove = (event: PointerEvent) => {
        const currentPending = pendingDrag.value
        const currentActive = dragState.value
        const pointerId = currentActive?.pointerId ?? currentPending?.pointerId
        if (pointerId === undefined || event.pointerId !== pointerId) {
          return
        }
        const currentEngine = engine.value
        const nextWorld = worldPointFromClient(
          injected,
          currentEngine,
          event.clientX,
          event.clientY,
        )
        const candidateHandle = resolveNodeHandleAtWorldPoint(
          injected.$nodes.value.values(),
          nextWorld,
          hotspotThickness.value,
          hotspotCornerClearance.value,
        )
        const candidateNode = candidateHandle
          ? currentEngine.findNode(candidateHandle.nodeId)
          : currentEngine.getNodeAt(nextWorld)
        const next = advanceConnectionDrag({
          pending: currentPending,
          active: currentActive,
          pointerId: event.pointerId,
          pointerWorld: nextWorld,
          candidateNodeId: candidateNode?.id ?? null,
          candidateAnchor: candidateHandle
            ? { side: candidateHandle.side, offset: candidateHandle.offset }
            : null,
          zoom: injected.$camera.value.z,
          threshold: CONNECTION_DRAG_THRESHOLD,
        })
        pendingDrag.value = next.pending
        dragState.value = next.active
      }

      const handleUp = (event: PointerEvent) => {
        if (
          pendingDrag.value &&
          event.pointerId === pendingDrag.value.pointerId
        ) {
          pendingDrag.value = null
          return
        }
        if (!dragState.value || event.pointerId !== dragState.value.pointerId) {
          return
        }
        commitDrag(dragState.value)
        dragState.value = null
      }

      const handleCancel = (event: PointerEvent) => {
        if (
          pendingDrag.value &&
          event.pointerId === pendingDrag.value.pointerId
        ) {
          pendingDrag.value = null
        }
        if (dragState.value && event.pointerId === dragState.value.pointerId) {
          dragState.value = null
        }
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleCancel)

      onCleanup(() => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleCancel)
      })
    })

    function renderReconnectHandle(
      entry: EdgeRenderEntry,
      end: DragEnd,
      endpoint: ResolvedConnectionEndpoint,
    ) {
      return h(
        'g',
        {
          'data-board-interactive': 'true',
          'data-connection-interactive': 'true',
          'data-connection-edge-id': String(entry.edge.id),
          'data-connection-handle': end,
          style: {
            pointerEvents: 'all',
            cursor: 'grab',
          },
          onPointerdown: (event: PointerEvent) =>
            beginReconnectDrag(entry, end, event),
        },
        [
          h('circle', {
            cx: endpoint.point.x,
            cy: endpoint.point.y,
            r: handleHitRadius.value,
            fill: 'rgba(15, 23, 42, 0.001)',
            stroke: 'none',
          }),
          h('circle', {
            cx: endpoint.point.x,
            cy: endpoint.point.y,
            r: handleRadius.value,
            fill: '#ffffff',
            stroke: entry.edge.color ?? 'var(--board-edge-active-color)',
            'stroke-width': 1.5 / Math.max(injected.$camera.value.z, 0.25),
            'vector-effect': 'non-scaling-stroke',
          }),
        ],
      )
    }

    function renderCreateHandle(nodeId: NodeId, side: AnchorSide) {
      const node = injected.$nodes.value.get(nodeId)
      if (!node) {
        return null
      }

      const point = resolveAnchorPoint(node, { side, offset: 0.5 })
      return h(
        'g',
        {
          'data-board-interactive': 'true',
          'data-connection-interactive': 'true',
          'data-connection-create-handle': 'true',
          'data-connection-node-id': String(nodeId),
          'data-connection-side': side,
          'data-connection-offset': '0.5',
          style: {
            pointerEvents: 'all',
            cursor: 'crosshair',
          },
          onPointerdown: (event: PointerEvent) =>
            beginCreateDrag(nodeId, side, event),
        },
        [
          h('circle', {
            cx: point.x,
            cy: point.y,
            r: handleHitRadius.value,
            fill: 'rgba(15, 23, 42, 0.001)',
            stroke: 'none',
          }),
          h('circle', {
            cx: point.x,
            cy: point.y,
            r: handleRadius.value * 0.9,
            fill: 'var(--board-edge-active-color)',
            stroke: '#ffffff',
            'stroke-width': 1.25 / Math.max(injected.$camera.value.z, 0.25),
            'vector-effect': 'non-scaling-stroke',
          }),
        ],
      )
    }

    function renderAnchorRail(
      nodeId: NodeId,
      anchor: AnchorPosition,
      options: { active?: boolean; createHandle?: boolean } = {},
    ) {
      const node = injected.$nodes.value.get(nodeId)
      if (!node) {
        return null
      }

      const start = resolveAnchorPoint(node, { side: anchor.side, offset: 0 })
      const end = resolveAnchorPoint(node, { side: anchor.side, offset: 1 })
      const point = resolveAnchorPoint(node, anchor)
      const strokeWidth =
        (options.active ? 2.4 : 1.6) / Math.max(injected.$camera.value.z, 0.25)
      return h(
        'g',
        {
          'data-connection-anchor-rail': String(nodeId),
          'data-connection-side': anchor.side,
          style: {
            pointerEvents: 'none',
          },
        },
        [
          h('line', {
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            stroke: 'var(--board-edge-active-color)',
            'stroke-width': strokeWidth,
            'stroke-linecap': 'round',
            'vector-effect': 'non-scaling-stroke',
            opacity: options.active ? 0.72 : 0.36,
          }),
          h('circle', {
            cx: point.x,
            cy: point.y,
            r: handleRadius.value * (options.active ? 1.12 : 0.92),
            fill: options.createHandle
              ? 'var(--board-edge-active-color)'
              : '#ffffff',
            stroke: 'var(--board-edge-active-color)',
            'stroke-width': 1.4 / Math.max(injected.$camera.value.z, 0.25),
            'vector-effect': 'non-scaling-stroke',
            opacity: options.active ? 1 : 0.9,
          }),
        ],
      )
    }

    function renderNodeHotspots() {
      const activeCreate =
        dragState.value?.mode === 'create' ? dragState.value : null
      const activeReconnect =
        dragState.value?.mode === 'reconnect' ? dragState.value : null
      const activeHandle = activeCreate
        ? renderCreateHandle(activeCreate.sourceNodeId, activeCreate.sourceSide)
        : null
      const hoveredHandle =
        hoveredNodeHandle.value &&
        (!activeCreate ||
          hoveredNodeHandle.value.nodeId !== activeCreate.sourceNodeId ||
          hoveredNodeHandle.value.side !== activeCreate.sourceSide)
          ? renderCreateHandle(
              hoveredNodeHandle.value.nodeId,
              hoveredNodeHandle.value.side,
            )
          : null
      const hoveredNodeHandles =
        hoveredNodeId.value &&
        (!activeCreate || hoveredNodeId.value !== activeCreate.sourceNodeId)
          ? (['top', 'right', 'bottom', 'left'] as const)
              .filter(
                (side) =>
                  !hoveredNodeHandle.value ||
                  hoveredNodeHandle.value.nodeId !== hoveredNodeId.value ||
                  hoveredNodeHandle.value.side !== side,
              )
              .map((side) =>
                renderCreateHandle(hoveredNodeId.value as NodeId, side),
              )
          : []
      const selectedEntry =
        selectedEdgeId.value && !activeReconnect
          ? entryById.value.get(selectedEdgeId.value)
          : undefined
      const selectedRails = selectedEntry
        ? [
            selectedEntry.edge.fromAnchor
              ? renderAnchorRail(
                  selectedEntry.edge.from,
                  selectedEntry.edge.fromAnchor,
                )
              : null,
            selectedEntry.edge.toAnchor
              ? renderAnchorRail(
                  selectedEntry.edge.to,
                  selectedEntry.edge.toAnchor,
                )
              : null,
          ]
        : []
      const activeRail =
        activeReconnect?.candidateNodeId && activeReconnect.candidateAnchor
          ? renderAnchorRail(
              activeReconnect.candidateNodeId,
              activeReconnect.candidateAnchor,
              { active: true },
            )
          : activeCreate?.candidateNodeId && activeCreate.candidateAnchor
            ? renderAnchorRail(
                activeCreate.candidateNodeId,
                activeCreate.candidateAnchor,
                { active: true, createHandle: true },
              )
            : null

      return [
        ...selectedRails,
        ...(activeRail ? [activeRail] : []),
        ...(activeHandle ? [activeHandle] : []),
        ...(hoveredHandle ? [hoveredHandle] : []),
        ...hoveredNodeHandles,
      ]
    }

    function renderEdgeLabel(
      entry: EdgeRenderEntry,
      state: { isSelected: boolean; isHovered: boolean },
    ) {
      const edgeId = String(entry.edge.id)
      return h(ConnectionLabel, {
        edgeId,
        point: entry.route.labelPoint,
        label: entry.edge.label ?? '',
        color: entry.edge.color ?? 'var(--board-edge-color)',
        zoom: injected.$camera.value.z,
        selected: state.isSelected,
        hovered: state.isHovered,
        editing: editingEdgeId.value === edgeId,
        draft: labelDraft.value,
        onEdgePointerDown: onEdgePointerDown,
        onBeginEdit: beginLabelEdit,
        onUpdateDraft: (value: string) => {
          labelDraft.value = value
        },
        onCommitEdit: commitLabelEdit,
        onCancelEdit: cancelLabelEdit,
      })
    }

    function renderEdge(entry: EdgeRenderEntry) {
      const edgeId = String(entry.edge.id)
      const isSelected = selectedEdgeId.value === edgeId
      const isHovered = hoveredEdgeId.value === edgeId
      const isDragging =
        dragState.value?.mode === 'reconnect' &&
        dragState.value.edgeId === edgeId
      const showHandles = isSelected || isHovered || isDragging
      const zoom = Math.max(injected.$camera.value.z, 0.25)
      const idleDetail = resolveLodAmount(
        zoom,
        EDGE_STROKE_LOD_FADE_START,
        EDGE_STROKE_LOD_SOFTEN_AT,
      )
      const stroke = entry.edge.color ?? 'var(--board-edge-color)'
      const strokeOpacity = isDragging
        ? 0.22
        : isSelected
          ? 0.98
          : isHovered
            ? 0.92
            : 0.24 + idleDetail * 0.46
      const strokeWidth = isSelected
        ? edgeStrokeWidth.value + 0.4
        : isHovered
          ? edgeStrokeWidth.value + 0.2
          : 1.15 + idleDetail * 0.7

      const visibleContent = slots.edge
        ? slots.edge(entry)
        : renderDefaultEdgePath({
            entry,
            markerId,
            stroke,
            opacity: strokeOpacity,
            strokeWidth,
          })

      const label = renderEdgeLabel(entry, { isSelected, isHovered })

      return h(
        'g',
        {
          'data-connection-edge-id': edgeId,
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
              cursor: 'pointer',
            },
            onPointerdown: (event: PointerEvent) =>
              onEdgePointerDown(edgeId, event),
            onDblclick: (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              beginLabelEdit(edgeId)
            },
            onPointerleave: (event: PointerEvent) => {
              if (
                !sameEdgeTarget(event.relatedTarget, edgeId) &&
                selectedEdgeId.value !== edgeId &&
                !(
                  dragState.value?.mode === 'reconnect' &&
                  dragState.value.edgeId === edgeId
                )
              ) {
                hoveredEdgeId.value = null
              }
            },
          }),
          ...(showHandles
            ? [
                renderReconnectHandle(entry, 'from', entry.source),
                renderReconnectHandle(entry, 'to', entry.target),
              ]
            : []),
          ...(label ? [label] : []),
        ],
      )
    }

    function renderPreview() {
      if (!preview.value || !dragState.value) return []
      return renderConnectionPreview({
        preview: preview.value,
        drag: dragState.value,
        markerId,
        zoom: Math.max(injected.$camera.value.z, 0.25),
        handleRadius: handleRadius.value,
        strokeWidth: previewStrokeWidth.value,
      })
    }

    function renderToolbar() {
      const edgeId = selectedEdgeId.value
      if (!edgeId) return null

      const entry = entryById.value.get(edgeId)
      if (
        !entry ||
        (dragState.value?.mode === 'reconnect' &&
          dragState.value.edgeId === edgeId) ||
        editingEdgeId.value === edgeId
      ) {
        return null
      }

      const camera = injected.$camera.value
      return renderConnectionToolbar({
        edge: entry.edge,
        screen: {
          x: (entry.route.labelPoint.x + camera.x) * camera.z,
          y: (entry.route.labelPoint.y + camera.y) * camera.z,
        },
        colorMenuOpen: colorMenuEdgeId.value === edgeId,
        directionMenuOpen: directionMenuEdgeId.value === edgeId,
        onDelete: () => deleteEdge(edgeId),
        onToggleColorMenu: () => {
          colorMenuEdgeId.value =
            colorMenuEdgeId.value === edgeId ? null : edgeId
          directionMenuEdgeId.value = null
        },
        onToggleDirectionMenu: () => {
          directionMenuEdgeId.value =
            directionMenuEdgeId.value === edgeId ? null : edgeId
          colorMenuEdgeId.value = null
        },
        onSetColor: (color) => applyEdgeColor(edgeId, color),
        onSetDirectionality: (direction) =>
          setDirectionality(edgeId, direction),
        onResetAnchor: (end) => resetEndpointAnchor(edgeId, end),
        onClearLabel: () => clearLabel(edgeId),
        onBeginLabelEdit: () => beginLabelEdit(edgeId),
      })
    }

    function renderSvg() {
      const zoom = Math.max(injected.$camera.value.z, 0.25)
      const markerSize = resolveArrowScreenSize(zoom) / zoom

      return h(
        'svg',
        {
          class: 'board-connection-layer',
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
            transform: `scale(${injected.$camera.value.z}) translate(${injected.$camera.value.x}px, ${injected.$camera.value.y}px)`,
            transformOrigin: '0 0',
            zIndex: '6',
            '--board-zoom': String(injected.$camera.value.z),
          },
        },
        [
          h('defs', [
            h(
              'marker',
              {
                id: markerId,
                markerWidth: markerSize,
                markerHeight: markerSize,
                refX: 13.8,
                refY: 9,
                orient: 'auto-start-reverse',
                markerUnits: 'userSpaceOnUse',
                viewBox: `0 0 ${EDGE_ARROW_MARKER_SIZE} ${EDGE_ARROW_MARKER_SIZE}`,
              },
              [
                h('path', {
                  d: 'M1.8,1.8 L15.6,9 L1.8,16.2 L6.3,9 Z',
                  fill: 'currentColor',
                }),
              ],
            ),
          ]),
          ...entries.value.map((entry) => renderEdge(entry)),
          ...renderNodeHotspots().filter(Boolean),
          ...renderPreview().filter(Boolean),
        ],
      )
    }

    return () => {
      const svg = renderSvg()
      const toolbar = renderToolbar()
      const root = injected.rootElement.value
      if (root) {
        return h(Teleport, { to: root }, [svg, ...(toolbar ? [toolbar] : [])])
      }
      return [svg, ...(toolbar ? [toolbar] : [])]
    }
  },
})
