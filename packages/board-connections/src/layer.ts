import {
  Teleport,
  computed,
  defineComponent,
  h,
  nextTick,
  shallowRef,
  useId,
  watch,
  type PropType,
} from 'vue'
import {
  type BoardEngine,
  type BoardNode,
  type EdgeId,
  type NodeId,
} from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'
import {
  buildConnectionRoute,
  resolveAnchorPoint,
  resolveConnectionEndpoint,
  resolveEdgeRenderState,
  resolveFloatingEndpoint,
} from './geometry.js'
import { EDGE_COLOR_PRESETS, resolvePresetColor } from './colors.js'
import { edgeEndsForDirectionality } from './directionality.js'
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
  EDGE_LABEL_ACTIVE_FONT_SIZE,
  EDGE_LABEL_ACTIVE_HEIGHT,
  EDGE_LABEL_HORIZONTAL_PADDING,
  EDGE_LABEL_IDLE_HEIGHT,
  EDGE_LABEL_MAX_SCREEN_WIDTH,
  EDGE_LABEL_MIN_ZOOM,
  EDGE_LABEL_SCREEN_FONT_SIZE,
  EDGE_STROKE_LOD_FADE_START,
  EDGE_STROKE_LOD_SOFTEN_AT,
  floatingNodeAt,
  resolveArrowScreenSize,
  resolveLodAmount,
  sameAnchor,
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
  type CreateDragState,
  type DragEnd,
  type PendingConnectionDrag,
  type ReconnectDragState,
} from './controller.js'
import { renderConnectionPreview, renderDefaultEdgePath } from './renderer.js'

type EdgeRenderEntry = ReturnType<typeof resolveEdgeRenderState> & {
  edge: BoardEdge
}
const TOOLBAR_ICON_SIZE = 24

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
    const version = shallowRef(0)
    const markerId = `board-connection-arrow-${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`
    const sideCache = new Map<
      string,
      { source: AnchorSide; target: AnchorSide }
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
          current.$nodes.subscribe(() => scheduleVersion()),
        ]
        onCleanup(() => {
          for (const unsubscribe of unsubscribes) {
            unsubscribe()
          }
        })
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
            target.closest('[data-board-interactive="true"]')
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
      void version.value
      const nodes = injected.$nodes.value
      const currentEngine = engine.value
      const routing =
        props.routing ?? currentEngine.plugins.connections.getConfig().routing
      const nextCache = new Map<
        string,
        { source: AnchorSide; target: AnchorSide }
      >()

      const resolved = currentEngine.plugins.connections
        .getEdges()
        .map((edge) => {
          const sourceNode = nodes.get(edge.from)
          const targetNode = nodes.get(edge.to)
          if (!sourceNode || !targetNode) {
            return null
          }

          const previous = sideCache.get(String(edge.id))
          const geometry = resolveEdgeRenderState(
            edge,
            sourceNode,
            targetNode,
            {
              routing,
              previousSourceSide: previous?.source,
              previousTargetSide: previous?.target,
            },
          )

          nextCache.set(String(edge.id), {
            source: geometry.source.side,
            target: geometry.target.side,
          })

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

    function onEdgePointerDown(edgeId: string, event: PointerEvent): void {
      event.preventDefault()
      event.stopPropagation()
      if (editingEdgeId.value && editingEdgeId.value !== edgeId) {
        commitLabelEdit()
      }
      selectedEdgeId.value = edgeId
      hoveredEdgeId.value = edgeId
      hoveredNodeHandle.value = null
    }

    function beginLabelEdit(edgeId: string): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      selectedEdgeId.value = edgeId
      hoveredEdgeId.value = edgeId
      editingEdgeId.value = edgeId
      labelDraft.value = entry.edge.label ?? ''
      nextTick(() => {
        const input =
          injected.rootElement.value?.querySelector<HTMLInputElement>(
            `[data-connection-label-input="${edgeId}"]`,
          )
        if (input) {
          input.focus()
          input.select()
        }
      })
    }

    function commitLabelEdit(): void {
      const id = editingEdgeId.value
      if (!id) {
        return
      }
      const entry = entryById.value.get(id)
      editingEdgeId.value = null
      if (!entry) {
        return
      }
      const next = labelDraft.value.trim()
      const current = entry.edge.label ?? ''
      if (next === current) {
        return
      }
      engine.value.plugins.connections.updateEdge(entry.edge.id, {
        label: next ? next : undefined,
      })
    }

    function clearLabel(edgeId: string): void {
      const entry = entryById.value.get(edgeId)
      if (!entry || !entry.edge.label) {
        return
      }
      if (editingEdgeId.value === edgeId) {
        editingEdgeId.value = null
      }
      engine.value.plugins.connections.updateEdge(entry.edge.id, {
        label: undefined,
      })
    }

    function cancelLabelEdit(): void {
      editingEdgeId.value = null
      labelDraft.value = ''
    }

    function setDirectionality(
      edgeId: string,
      direction: 'none' | 'to' | 'both',
    ): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      const next = edgeEndsForDirectionality(
        direction === 'to' ? 'end' : direction,
      )
      engine.value.plugins.connections.updateEdge(entry.edge.id, {
        fromEnd: next.fromEnd,
        toEnd: next.toEnd,
      })
      directionMenuEdgeId.value = null
    }

    function applyEdgeColor(edgeId: string, color: string | undefined): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      engine.value.plugins.connections.updateEdge(entry.edge.id, { color })
      colorMenuEdgeId.value = null
    }

    function resetEndpointAnchor(edgeId: string, end: DragEnd | 'both'): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      engine.value.plugins.connections.updateEdge(entry.edge.id, {
        ...(end === 'from' || end === 'both' ? { fromAnchor: undefined } : {}),
        ...(end === 'to' || end === 'both' ? { toAnchor: undefined } : {}),
      })
    }

    function deleteEdge(edgeId: string): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      if (editingEdgeId.value === edgeId) {
        editingEdgeId.value = null
      }
      if (selectedEdgeId.value === edgeId) {
        selectedEdgeId.value = null
      }
      if (hoveredEdgeId.value === edgeId) {
        hoveredEdgeId.value = null
      }
      if (colorMenuEdgeId.value === edgeId) {
        colorMenuEdgeId.value = null
      }
      if (directionMenuEdgeId.value === edgeId) {
        directionMenuEdgeId.value = null
      }
      engine.value.plugins.connections.deleteEdge(entry.edge.id as EdgeId)
    }

    function commitReconnect(active: ReconnectDragState): void {
      const entry = entryById.value.get(active.edgeId)
      if (!entry || !active.candidateNodeId) {
        return
      }

      const nodeId = active.candidateNodeId
      const connections = engine.value.plugins.connections
      if (active.end === 'from') {
        if (
          entry.edge.from === nodeId &&
          sameAnchor(entry.edge.fromAnchor, active.candidateAnchor)
        ) {
          return
        }
        connections.updateEdge(entry.edge.id, {
          from: nodeId,
          fromAnchor: active.candidateAnchor ?? undefined,
        })
        return
      }

      if (
        entry.edge.to === nodeId &&
        sameAnchor(entry.edge.toAnchor, active.candidateAnchor)
      ) {
        return
      }

      connections.updateEdge(entry.edge.id, {
        to: nodeId,
        toAnchor: active.candidateAnchor ?? undefined,
      })
    }

    function commitCreate(active: CreateDragState): void {
      const currentEngine = engine.value
      const sourceNode = currentEngine.findNode(active.sourceNodeId)
      if (!sourceNode) {
        return
      }

      const targetNode = active.candidateNodeId
        ? currentEngine.findNode(active.candidateNodeId)
        : props.createNodeForConnection?.({
            sourceNodeId: active.sourceNodeId,
            sourceSide: active.sourceSide,
            pointerWorld: { ...active.pointerWorld },
            candidateAnchor: active.candidateAnchor
              ? { ...active.candidateAnchor }
              : null,
          })
      if (!targetNode) {
        return
      }

      const createdEdge = currentEngine.plugins.connections.createEdge({
        from: sourceNode.id,
        to: targetNode.id,
        fromAnchor:
          endpointMode.value === 'manual'
            ? { side: active.sourceSide, offset: 0.5 }
            : undefined,
        toAnchor:
          endpointMode.value === 'manual' && active.candidateAnchor
            ? active.candidateAnchor
            : undefined,
        data: {},
      })

      selectedEdgeId.value = String(createdEdge.id)
      hoveredEdgeId.value = String(createdEdge.id)
    }

    function commitDrag(active: ConnectionDragState): void {
      if (active.mode === 'reconnect') {
        commitReconnect(active)
      } else {
        commitCreate(active)
      }
    }

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

    watch(selectedEdgeId, (_next, _prev, onCleanup) => {
      if (!selectedEdgeId.value) {
        return
      }
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
          colorMenuEdgeId.value = null
          directionMenuEdgeId.value = null
        }
      }
      window.addEventListener('keydown', handleKey)
      onCleanup(() => {
        window.removeEventListener('keydown', handleKey)
      })
    })

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
      state: {
        isSelected: boolean
        isHovered: boolean
      },
    ) {
      const edgeId = String(entry.edge.id)
      const isEditing = editingEdgeId.value === edgeId
      const label = entry.edge.label ?? ''
      if (!isEditing && !label) {
        return null
      }

      const active = isEditing || state.isSelected || state.isHovered
      const labelZoom = Math.max(injected.$camera.value.z, EDGE_LABEL_MIN_ZOOM)
      const stroke = entry.edge.color ?? 'var(--board-edge-color)'
      const size = 1 / labelZoom
      const approxWidth = Math.max(
        active ? 40 : 24,
        Math.min(
          EDGE_LABEL_MAX_SCREEN_WIDTH,
          ((isEditing ? labelDraft.value : label).length || 1) * 8 +
            EDGE_LABEL_HORIZONTAL_PADDING,
        ),
      )
      const approxHeight = active
        ? EDGE_LABEL_ACTIVE_HEIGHT
        : EDGE_LABEL_IDLE_HEIGHT
      const width = approxWidth * size
      const height = approxHeight * size
      const x = entry.route.labelPoint.x - width / 2
      const y = entry.route.labelPoint.y - height / 2

      const contents = isEditing
        ? h('input', {
            'data-connection-label-input': edgeId,
            'data-board-interactive': 'true',
            'data-connection-edge-id': edgeId,
            type: 'text',
            value: labelDraft.value,
            onInput: (event: Event) => {
              labelDraft.value = (event.target as HTMLInputElement).value
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitLabelEdit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelLabelEdit()
              }
              event.stopPropagation()
            },
            onBlur: () => commitLabelEdit(),
            onPointerdown: (event: PointerEvent) => event.stopPropagation(),
            style: {
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              padding: '2px 8px',
              borderRadius: '999px',
              border: '1px solid currentColor',
              background: 'var(--board-node-bg, #fff)',
              color: 'inherit',
              font: 'inherit',
              fontSize: `${EDGE_LABEL_ACTIVE_FONT_SIZE}px`,
              lineHeight: '1',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            },
          })
        : h(
            'div',
            {
              'data-connection-label': edgeId,
              'data-board-interactive': 'true',
              'data-connection-edge-id': edgeId,
              title: label,
              onPointerdown: (event: PointerEvent) =>
                onEdgePointerDown(edgeId, event),
              onDblclick: (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                beginLabelEdit(edgeId)
              },
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: active ? '2px 8px' : '0 3px',
                maxWidth: `${EDGE_LABEL_MAX_SCREEN_WIDTH}px`,
                borderRadius: '999px',
                border: active
                  ? '1px solid currentColor'
                  : '1px solid transparent',
                background: active
                  ? 'var(--board-node-bg, #fff)'
                  : 'transparent',
                fontSize: `${active ? EDGE_LABEL_ACTIVE_FONT_SIZE : EDGE_LABEL_SCREEN_FONT_SIZE}px`,
                lineHeight: active ? '1' : '1.2',
                fontWeight: active ? '500' : '600',
                color: 'inherit',
                cursor: 'text',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: active
                  ? 'none'
                  : '0 1px 0 var(--board-node-bg, #fff), 0 -1px 0 var(--board-node-bg, #fff), 1px 0 0 var(--board-node-bg, #fff), -1px 0 0 var(--board-node-bg, #fff)',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              },
            },
            label || '\u00A0',
          )

      return h(
        'foreignObject',
        {
          x,
          y,
          width,
          height,
          color: stroke,
          style: {
            overflow: 'visible',
            pointerEvents: 'auto',
          },
        },
        [
          h(
            'div',
            {
              xmlns: 'http://www.w3.org/1999/xhtml',
              style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: '1',
              },
            },
            [
              h(
                'div',
                {
                  style: {
                    width: `${approxWidth}px`,
                    height: `${approxHeight}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                },
                [contents],
              ),
            ],
          ),
        ],
      )
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
      if (!edgeId) {
        return null
      }
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return null
      }
      if (
        dragState.value?.mode === 'reconnect' &&
        dragState.value.edgeId === edgeId
      ) {
        return null
      }
      if (editingEdgeId.value === edgeId) {
        return null
      }

      const camera = injected.$camera.value
      const screen = {
        x: (entry.route.labelPoint.x + camera.x) * camera.z,
        y: (entry.route.labelPoint.y + camera.y) * camera.z,
      }

      const currentColor = entry.edge.color
      const hasFromAnchor = Boolean(entry.edge.fromAnchor)
      const hasToAnchor = Boolean(entry.edge.toAnchor)
      const hasManualAnchor = hasFromAnchor || hasToAnchor
      const from = entry.edge.fromEnd ?? 'none'
      const to = entry.edge.toEnd ?? 'arrow'
      const activeDirection =
        from === 'arrow' && to === 'arrow'
          ? 'both'
          : from === 'none' && to === 'none'
            ? 'none'
            : 'to'
      const buttonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        padding: '0',
        border: 'none',
        background: 'transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        lineHeight: '1',
        color: 'var(--board-muted-fg, #6b7280)',
      } as const

      const swatchStyle = (hex: string, active: boolean) =>
        ({
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: hex,
          border: active
            ? '2px solid var(--board-fg, #0f172a)'
            : '1px solid rgba(15, 23, 42, 0.15)',
          cursor: 'pointer',
          padding: '0',
          boxSizing: 'border-box',
        }) as const

      const renderIcon = (
        paths: string[],
        options?: { viewBox?: string; fill?: string },
      ) =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            width: TOOLBAR_ICON_SIZE,
            height: TOOLBAR_ICON_SIZE,
            viewBox: options?.viewBox ?? '0 0 24 24',
            fill: options?.fill ?? 'none',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          paths.map((d) => h('path', { d })),
        )

      const toolbarButton = (
        title: string,
        icon: ReturnType<typeof h>,
        onClick: (event: MouseEvent) => void,
        options?: { disabled?: boolean; danger?: boolean; testId?: string },
      ) =>
        h(
          'button',
          {
            'data-board-interactive': 'true',
            ...(options?.testId ? { [options.testId]: edgeId } : {}),
            type: 'button',
            title,
            'aria-label': title,
            disabled: options?.disabled,
            style: {
              ...buttonStyle,
              opacity: options?.disabled ? '0.38' : '1',
              color: options?.danger
                ? '#b45353'
                : 'var(--board-muted-fg, #6b7280)',
              cursor: options?.disabled ? 'default' : 'pointer',
            },
            onClick,
          },
          [icon],
        )

      const divider = () =>
        h('span', {
          style: {
            display: 'inline-block',
            width: '1px',
            height: '22px',
            background: 'rgba(15,23,42,0.12)',
            margin: '0 2px',
          },
        })
      const directionItem = (
        label: string,
        icon: ReturnType<typeof h>,
        direction: 'none' | 'to' | 'both',
      ) =>
        h(
          'button',
          {
            'data-board-interactive': 'true',
            'data-connection-direction-option': direction,
            type: 'button',
            title: label,
            'aria-label': label,
            style: {
              display: 'grid',
              gridTemplateColumns: '32px 1fr 24px',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              minWidth: '250px',
              height: '42px',
              padding: '0 12px',
              border: 'none',
              borderRadius: '7px',
              background:
                activeDirection === direction
                  ? 'rgba(107, 114, 128, 0.16)'
                  : 'transparent',
              color: 'var(--board-fg, #111827)',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: '18px',
              lineHeight: '1',
              textAlign: 'left',
            },
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              setDirectionality(edgeId, direction)
            },
          },
          [
            h('span', { style: { color: 'var(--board-muted-fg, #6b7280)' } }, [
              icon,
            ]),
            h('span', label),
            activeDirection === direction
              ? renderIcon(['m20 6-11 11-5-5'])
              : h('span'),
          ],
        )

      return h(
        'div',
        {
          'data-board-interactive': 'true',
          'data-connection-toolbar': edgeId,
          onPointerdown: (event: PointerEvent) => event.stopPropagation(),
          style: {
            position: 'absolute',
            left: `${screen.x}px`,
            top: `${screen.y}px`,
            transform: 'translate(-50%, calc(-100% - 14px))',
            zIndex: '7',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px',
            background: 'var(--board-node-bg, #ffffff)',
            border: '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
            borderRadius: '6px',
            boxShadow:
              '0 4px 14px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.08)',
            fontSize: '12px',
            color: 'var(--board-fg, #0f172a)',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
            userSelect: 'none',
          },
        },
        [
          toolbarButton(
            'Remove',
            renderIcon([
              'M10 11v6',
              'M14 11v6',
              'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
              'M3 6h18',
              'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              deleteEdge(edgeId)
            },
            { danger: true },
          ),
          h(
            'div',
            {
              style: {
                position: 'relative',
                display: 'inline-flex',
              },
            },
            [
              toolbarButton(
                'Set colour',
                renderIcon([
                  'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z',
                  'M13.5 6.5h.01',
                  'M17.5 10.5h.01',
                  'M6.5 12.5h.01',
                  'M8.5 7.5h.01',
                ]),
                (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  colorMenuEdgeId.value =
                    colorMenuEdgeId.value === edgeId ? null : edgeId
                  directionMenuEdgeId.value = null
                },
              ),
              colorMenuEdgeId.value === edgeId
                ? h(
                    'div',
                    {
                      'data-board-interactive': 'true',
                      'data-connection-color-menu': edgeId,
                      style: {
                        position: 'absolute',
                        left: '50%',
                        top: 'calc(100% + 8px)',
                        transform: 'translateX(-50%)',
                        zIndex: '1',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 20px)',
                        gap: '8px',
                        padding: '8px',
                        background: 'var(--board-node-bg, #ffffff)',
                        border:
                          '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
                        borderRadius: '6px',
                        boxShadow:
                          '0 6px 18px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(15, 23, 42, 0.08)',
                      },
                    },
                    [
                      h('button', {
                        'data-board-interactive': 'true',
                        type: 'button',
                        title: 'Default color',
                        style: {
                          ...swatchStyle('transparent', !currentColor),
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0 3px, transparent 3px 6px)',
                        },
                        onClick: (event: MouseEvent) => {
                          event.preventDefault()
                          event.stopPropagation()
                          applyEdgeColor(edgeId, undefined)
                        },
                      }),
                      ...EDGE_COLOR_PRESETS.map((option) =>
                        h('button', {
                          'data-board-interactive': 'true',
                          type: 'button',
                          title: option.label,
                          style: swatchStyle(
                            option.hex,
                            resolvePresetColor(currentColor) === option.hex,
                          ),
                          onClick: (event: MouseEvent) => {
                            event.preventDefault()
                            event.stopPropagation()
                            applyEdgeColor(edgeId, option.hex)
                          },
                        }),
                      ),
                    ],
                  )
                : null,
            ],
          ),
          divider(),
          h(
            'div',
            {
              style: {
                position: 'relative',
                display: 'inline-flex',
              },
            },
            [
              toolbarButton(
                'Line direction',
                renderIcon(['M5 12h14', 'm12 5 7 7-7 7']),
                (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  directionMenuEdgeId.value =
                    directionMenuEdgeId.value === edgeId ? null : edgeId
                  colorMenuEdgeId.value = null
                },
                { testId: 'data-connection-direction-menu-button' },
              ),
              directionMenuEdgeId.value === edgeId
                ? h(
                    'div',
                    {
                      'data-board-interactive': 'true',
                      'data-connection-direction-menu': edgeId,
                      style: {
                        position: 'absolute',
                        left: '50%',
                        top: 'calc(100% + 8px)',
                        transform: 'translateX(-50%)',
                        zIndex: '1',
                        display: 'grid',
                        gap: '2px',
                        padding: '8px',
                        background: 'var(--board-node-bg, #ffffff)',
                        border:
                          '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
                        borderRadius: '8px',
                        boxShadow:
                          '0 8px 22px rgba(15, 23, 42, 0.16), 0 1px 2px rgba(15, 23, 42, 0.08)',
                      },
                    },
                    [
                      directionItem(
                        'Nondirectional',
                        renderIcon(['M5 12h14']),
                        'none',
                      ),
                      directionItem(
                        'Unidirectional',
                        renderIcon(['M5 12h14', 'm12 5 7 7-7 7']),
                        'to',
                      ),
                      directionItem(
                        'Bidirectional',
                        renderIcon([
                          'M7 7 3 12l4 5',
                          'M17 7l4 5-4 5',
                          'M4 12h16',
                        ]),
                        'both',
                      ),
                    ],
                  )
                : null,
            ],
          ),
          hasManualAnchor ? divider() : null,
          hasFromAnchor
            ? toolbarButton(
                'Reset source anchor to auto',
                renderIcon([
                  'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
                  'M21 3v5h-5',
                  'M12 7v5l3 3',
                ]),
                (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  resetEndpointAnchor(edgeId, 'from')
                },
                { testId: 'data-connection-reset-source-anchor' },
              )
            : null,
          hasToAnchor
            ? toolbarButton(
                'Reset target anchor to auto',
                renderIcon([
                  'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
                  'M3 21v-5h5',
                  'M12 7v5l3 3',
                ]),
                (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  resetEndpointAnchor(edgeId, 'to')
                },
                { testId: 'data-connection-reset-target-anchor' },
              )
            : null,
          hasFromAnchor && hasToAnchor
            ? toolbarButton(
                'Reset connection to auto',
                renderIcon([
                  'M4 4v6h6',
                  'M20 20v-6h-6',
                  'M20 9A8 8 0 0 0 6.3 4.7L4 7',
                  'M4 15a8 8 0 0 0 13.7 4.3L20 17',
                ]),
                (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  resetEndpointAnchor(edgeId, 'both')
                },
                { testId: 'data-connection-reset-all-anchors' },
              )
            : null,
          toolbarButton(
            'Remove label',
            renderIcon(['M3 3h18v18H3z', 'm15 9-6 6', 'm9 9 6 6']),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              clearLabel(edgeId)
            },
            {
              disabled: !entry.edge.label,
              testId: 'data-connection-remove-label',
            },
          ),
          toolbarButton(
            'Edit label',
            renderIcon([
              'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
              'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              beginLabelEdit(edgeId)
            },
          ),
        ],
      )
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
