import {
  Teleport,
  computed,
  defineComponent,
  h,
  nextTick,
  shallowRef,
  watch,
  type PropType,
} from 'vue'
import {
  type BoardEngine,
  type BoardNode,
  type EdgeId,
  type NodeId,
  type Point,
} from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'
import {
  buildConnectionRoute,
  resolveAnchorPoint,
  resolveConnectionEndpoint,
  resolveEdgeRenderState,
  resolveFloatingEndpoint,
} from './geometry'
import { EDGE_COLOR_PRESETS, resolvePresetColor } from './colors'
import type {
  AnchorSide,
  BoardEdge,
  ConnectionRouting,
  ConnectionsExtension,
  EdgeEnd,
  ResolvedConnectionEndpoint,
} from './types'

type EdgeRenderEntry = ReturnType<typeof resolveEdgeRenderState> & {
  edge: BoardEdge
}
type DragEnd = 'from' | 'to'
type HoveredNodeHandle = {
  nodeId: NodeId
  side: AnchorSide
}
type ReconnectDragState = {
  mode: 'reconnect'
  edgeId: string
  end: DragEnd
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
}
type CreateDragState = {
  mode: 'create'
  sourceNodeId: NodeId
  sourceSide: AnchorSide
  pointerId: number
  pointerWorld: Point
  candidateNodeId: NodeId | null
}
type DragState = ReconnectDragState | CreateDragState
type PendingReconnectDrag = {
  mode: 'reconnect'
  edgeId: string
  end: DragEnd
  pointerId: number
  startWorld: Point
}
type PendingCreateDrag = {
  mode: 'create'
  sourceNodeId: NodeId
  sourceSide: AnchorSide
  pointerId: number
  startWorld: Point
}
type PendingDragState = PendingReconnectDrag | PendingCreateDrag

const CONNECTION_DRAG_THRESHOLD = 6

let markerCounter = 0

function edgeIdFromTarget(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-connection-edge-id]')?.dataset
        .connectionEdgeId ?? null)
    : null
}

function nodeHandleFromTarget(
  target: EventTarget | null,
): HoveredNodeHandle | null {
  if (!(target instanceof Element)) {
    return null
  }
  const element = target.closest<HTMLElement>(
    '[data-connection-node-id][data-connection-side]',
  )
  if (!element?.dataset.connectionNodeId || !element.dataset.connectionSide) {
    return null
  }
  return {
    nodeId: element.dataset.connectionNodeId as NodeId,
    side: element.dataset.connectionSide as AnchorSide,
  }
}

function sameEdgeTarget(target: EventTarget | null, edgeId: string): boolean {
  return edgeIdFromTarget(target) === edgeId
}

function worldPointFromClient(
  ctx: ReturnType<typeof useBoardEngine>,
  engine: BoardEngine,
  clientX: number,
  clientY: number,
): Point {
  return engine.screenToWorld(ctx.toLocalPoint(clientX, clientY))
}

function shouldPreserveDraggedAnchor(
  edge: BoardEdge,
  end: DragEnd,
  nodeId: NodeId,
): boolean {
  return end === 'from'
    ? edge.from === nodeId && Boolean(edge.fromAnchor)
    : edge.to === nodeId && Boolean(edge.toAnchor)
}

export const BoardConnectionLayer = defineComponent({
  name: 'BoardConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<BoardEngine | null>,
      default: null,
    },
    routing: {
      type: String as PropType<ConnectionRouting | undefined>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const injected = useBoardEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const version = shallowRef(0)
    const markerId = `board-connection-arrow-${(markerCounter += 1)}`
    const sideCache = new Map<
      string,
      { source: AnchorSide; target: AnchorSide }
    >()
    const hoveredEdgeId = shallowRef<string | null>(null)
    const hoveredNodeId = shallowRef<NodeId | null>(null)
    const hoveredNodeHandle = shallowRef<HoveredNodeHandle | null>(null)
    const selectedEdgeId = shallowRef<string | null>(null)
    const pendingDrag = shallowRef<PendingDragState | null>(null)
    const dragState = shallowRef<DragState | null>(null)
    const editingEdgeId = shallowRef<string | null>(null)
    const labelDraft = shallowRef<string>('')

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
          commitLabelEdit()
        }

        const handleRootPointerMove = (event: PointerEvent) => {
          if (dragState.value || pendingDrag.value) {
            return
          }
          const edgeId = edgeIdFromTarget(event.target)
          const nodeHandle = nodeHandleFromTarget(event.target)
          hoveredEdgeId.value =
            edgeId ?? (selectedEdgeId.value ? selectedEdgeId.value : null)
          hoveredNodeHandle.value = nodeHandle

          const currentEngine = engine.value
          const worldPoint = worldPointFromClient(
            injected,
            currentEngine,
            event.clientX,
            event.clientY,
          )
          const nodeUnderCursor = currentEngine.getNodeAt(worldPoint)
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
        props.routing ??
        (
          currentEngine.ext.connections as ConnectionsExtension & {
            __routing?: ConnectionRouting
          }
        ).__routing ??
        'bezier'
      const nextCache = new Map<
        string,
        { source: AnchorSide; target: AnchorSide }
      >()

      const resolved = currentEngine.ext.connections
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
        props.routing ??
        (
          engine.value.ext.connections as ConnectionsExtension & {
            __routing?: ConnectionRouting
          }
        ).__routing ??
        'bezier'

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
                  fromAnchor: shouldPreserveDraggedAnchor(
                    entry.edge,
                    'from',
                    candidateNode.id,
                  )
                    ? entry.edge.fromAnchor
                    : undefined,
                },
                candidateNode,
                fixed.node,
                'source',
                entry.source.side,
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
                toAnchor: shouldPreserveDraggedAnchor(
                  entry.edge,
                  'to',
                  candidateNode.id,
                )
                  ? entry.edge.toAnchor
                  : undefined,
              },
              candidateNode,
              fixed.node,
              'target',
              entry.target.side,
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

      const source: ResolvedConnectionEndpoint = {
        nodeId: sourceNode.id,
        node: sourceNode,
        side: active.sourceSide,
        offset: 0.5,
        point: resolveAnchorPoint(sourceNode, {
          side: active.sourceSide,
          offset: 0.5,
        }),
        kind: 'explicit',
      }

      const target = candidateNode
        ? resolveConnectionEndpoint(
            {
              id: 'preview-edge' as BoardEdge['id'],
              from: sourceNode.id,
              to: candidateNode.id,
              fromAnchor: { side: active.sourceSide, offset: 0.5 },
              data: {},
              zIndex: 0,
            },
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
      Math.max(14, 20 / Math.max(injected.$camera.value.z, 0.25)),
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
      engine.value.ext.connections.updateEdge(entry.edge.id, {
        label: next ? next : undefined,
      })
    }

    function cancelLabelEdit(): void {
      editingEdgeId.value = null
      labelDraft.value = ''
    }

    function cycleDirectionality(edgeId: string): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      const from = entry.edge.fromEnd ?? 'none'
      const to = entry.edge.toEnd ?? 'arrow'
      let nextFrom: EdgeEnd
      let nextTo: EdgeEnd
      if (from === 'none' && to === 'arrow') {
        nextFrom = 'arrow'
        nextTo = 'arrow'
      } else if (from === 'arrow' && to === 'arrow') {
        nextFrom = 'arrow'
        nextTo = 'none'
      } else {
        nextFrom = 'none'
        nextTo = 'arrow'
      }
      engine.value.ext.connections.updateEdge(entry.edge.id, {
        fromEnd: nextFrom,
        toEnd: nextTo,
      })
    }

    function applyEdgeColor(edgeId: string, color: string | undefined): void {
      const entry = entryById.value.get(edgeId)
      if (!entry) {
        return
      }
      engine.value.ext.connections.updateEdge(entry.edge.id, { color })
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
      engine.value.ext.connections.deleteEdge(entry.edge.id as EdgeId)
    }

    function commitReconnect(active: ReconnectDragState): void {
      const entry = entryById.value.get(active.edgeId)
      if (!entry || !active.candidateNodeId) {
        return
      }

      const nodeId = active.candidateNodeId
      const connections = engine.value.ext.connections
      if (active.end === 'from') {
        if (
          entry.edge.from === nodeId &&
          (!entry.edge.fromAnchor ||
            shouldPreserveDraggedAnchor(entry.edge, 'from', nodeId))
        ) {
          return
        }
        connections.updateEdge(entry.edge.id, {
          from: nodeId,
          fromAnchor: shouldPreserveDraggedAnchor(entry.edge, 'from', nodeId)
            ? entry.edge.fromAnchor
            : undefined,
        })
        return
      }

      if (
        entry.edge.to === nodeId &&
        (!entry.edge.toAnchor ||
          shouldPreserveDraggedAnchor(entry.edge, 'to', nodeId))
      ) {
        return
      }

      connections.updateEdge(entry.edge.id, {
        to: nodeId,
        toAnchor: shouldPreserveDraggedAnchor(entry.edge, 'to', nodeId)
          ? entry.edge.toAnchor
          : undefined,
      })
    }

    function commitCreate(active: CreateDragState): void {
      const currentEngine = engine.value
      const sourceNode = currentEngine.findNode(active.sourceNodeId)
      if (!sourceNode) {
        return
      }

      const targetNode =
        (active.candidateNodeId
          ? currentEngine.findNode(active.candidateNodeId)
          : null) ??
        (() => {
          const created = currentEngine.createNode({
            type: 'text',
            x: active.pointerWorld.x,
            y: active.pointerWorld.y,
            data: { content: '' },
          })
          const centered = currentEngine.updateNode(created.id, {
            x: created.x - created.width / 2,
            y: created.y - created.height / 2,
          })
          currentEngine.beginTextEdit(centered.id)
          return centered
        })()

      const createdEdge = currentEngine.ext.connections.createEdge({
        from: sourceNode.id,
        to: targetNode.id,
        fromAnchor: { side: active.sourceSide, offset: 0.5 },
        data: {},
      })

      selectedEdgeId.value = String(createdEdge.id)
      hoveredEdgeId.value = String(createdEdge.id)
    }

    function commitDrag(active: DragState): void {
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

      const currentEngine = engine.value
      const nextWorld = worldPointFromClient(
        injected,
        currentEngine,
        event.clientX,
        event.clientY,
      )
      hoveredEdgeId.value = null
      selectedEdgeId.value = null
      hoveredNodeHandle.value = { nodeId, side }
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
        const candidateNode = currentEngine.getNodeAt(nextWorld)
        if (currentPending) {
          const screenDistance =
            Math.hypot(
              nextWorld.x - currentPending.startWorld.x,
              nextWorld.y - currentPending.startWorld.y,
            ) * injected.$camera.value.z
          if (screenDistance < CONNECTION_DRAG_THRESHOLD) {
            return
          }
          dragState.value =
            currentPending.mode === 'reconnect'
              ? {
                  mode: 'reconnect',
                  edgeId: currentPending.edgeId,
                  end: currentPending.end,
                  pointerId: currentPending.pointerId,
                  pointerWorld: nextWorld,
                  candidateNodeId: candidateNode?.id ?? null,
                }
              : {
                  mode: 'create',
                  sourceNodeId: currentPending.sourceNodeId,
                  sourceSide: currentPending.sourceSide,
                  pointerId: currentPending.pointerId,
                  pointerWorld: nextWorld,
                  candidateNodeId: candidateNode?.id ?? null,
                }
          pendingDrag.value = null
          return
        }

        if (!currentActive) {
          return
        }

        dragState.value = {
          ...currentActive,
          pointerWorld: nextWorld,
          candidateNodeId: candidateNode?.id ?? null,
        }
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

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)

      onCleanup(() => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
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

      const hotspots = Array.from(injected.$nodes.value.values())
        .filter((node) => node.visible)
        .flatMap((node) => {
          const clearance = Math.min(
            hotspotCornerClearance.value,
            Math.min(node.width, node.height) / 3,
          )
          const horizontalWidth = Math.max(
            node.width - clearance * 2,
            hotspotThickness.value,
          )
          const verticalHeight = Math.max(
            node.height - clearance * 2,
            hotspotThickness.value,
          )
          const specs: Array<{
            side: AnchorSide
            x: number
            y: number
            width: number
            height: number
          }> = [
            {
              side: 'top',
              x: node.x + (node.width - horizontalWidth) / 2,
              y: node.y - hotspotThickness.value / 2,
              width: horizontalWidth,
              height: hotspotThickness.value,
            },
            {
              side: 'right',
              x: node.x + node.width - hotspotThickness.value / 2,
              y: node.y + (node.height - verticalHeight) / 2,
              width: hotspotThickness.value,
              height: verticalHeight,
            },
            {
              side: 'bottom',
              x: node.x + (node.width - horizontalWidth) / 2,
              y: node.y + node.height - hotspotThickness.value / 2,
              width: horizontalWidth,
              height: hotspotThickness.value,
            },
            {
              side: 'left',
              x: node.x - hotspotThickness.value / 2,
              y: node.y + (node.height - verticalHeight) / 2,
              width: hotspotThickness.value,
              height: verticalHeight,
            },
          ]

          return specs.map((spec) =>
            h('rect', {
              x: spec.x,
              y: spec.y,
              width: spec.width,
              height: spec.height,
              rx: hotspotThickness.value / 2,
              ry: hotspotThickness.value / 2,
              fill: 'rgba(15, 23, 42, 0.001)',
              stroke: 'none',
              'data-board-interactive': 'true',
              'data-connection-interactive': 'true',
              'data-connection-node-id': String(node.id),
              'data-connection-side': spec.side,
              style: {
                pointerEvents: 'all',
                cursor: 'crosshair',
              },
              onPointerenter: () => {
                if (!dragState.value && !pendingDrag.value) {
                  hoveredNodeHandle.value = { nodeId: node.id, side: spec.side }
                  hoveredEdgeId.value = null
                }
              },
              onPointermove: () => {
                if (!dragState.value && !pendingDrag.value) {
                  hoveredNodeHandle.value = { nodeId: node.id, side: spec.side }
                  hoveredEdgeId.value = null
                }
              },
              onPointerleave: () => {
                if (
                  !dragState.value &&
                  !pendingDrag.value &&
                  hoveredNodeHandle.value?.nodeId === node.id &&
                  hoveredNodeHandle.value.side === spec.side
                ) {
                  hoveredNodeHandle.value = null
                }
              },
              onPointerdown: (event: PointerEvent) =>
                beginCreateDrag(node.id, spec.side, event),
            }),
          )
        })
      return [
        ...hotspots,
        ...(activeHandle ? [activeHandle] : []),
        ...(hoveredHandle ? [hoveredHandle] : []),
      ]
    }

    function renderEdgeLabel(entry: EdgeRenderEntry) {
      const edgeId = String(entry.edge.id)
      const isEditing = editingEdgeId.value === edgeId
      const label = entry.edge.label ?? ''
      if (!isEditing && !label) {
        return null
      }

      const zoom = Math.max(injected.$camera.value.z, 0.25)
      const stroke = entry.edge.color ?? 'var(--board-edge-color)'
      const size = 1 / zoom
      const approxWidth = Math.max(
        40,
        ((isEditing ? labelDraft.value : label).length || 1) * 8 + 24,
      )
      const approxHeight = 22
      const width = approxWidth * size
      const height = approxHeight * size
      const x = entry.route.labelPoint.x - width / 2
      const y = entry.route.labelPoint.y - height / 2

      const contents = isEditing
        ? h('input', {
            'data-connection-label-input': edgeId,
            'data-board-interactive': 'true',
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
              fontSize: '12px',
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
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid currentColor',
                background: 'var(--board-node-bg, #fff)',
                fontSize: '12px',
                lineHeight: '1',
                color: 'inherit',
                cursor: 'text',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
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
                transform: `scale(${size})`,
                transformOrigin: 'center center',
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
      const stroke = entry.edge.color ?? 'var(--board-edge-color)'
      const strokeOpacity = isDragging
        ? 0.22
        : isSelected
          ? 0.98
          : isHovered
            ? 0.92
            : 0.7
      const strokeWidth = isSelected
        ? edgeStrokeWidth.value + 0.4
        : isHovered
          ? edgeStrokeWidth.value + 0.2
          : edgeStrokeWidth.value

      const visibleContent = slots.edge
        ? slots.edge(entry)
        : h('path', {
            d: entry.route.path,
            stroke,
            color: entry.edge.color ?? 'var(--board-edge-color)',
            fill: 'none',
            opacity: strokeOpacity,
            'stroke-width': strokeWidth,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke',
            'marker-start':
              entry.edge.fromEnd === 'arrow' ? `url(#${markerId})` : undefined,
            'marker-end':
              entry.edge.toEnd === 'arrow' ? `url(#${markerId})` : undefined,
            style: {
              pointerEvents: 'none',
            },
          })

      const label = renderEdgeLabel(entry)

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
      if (!preview.value) {
        return []
      }

      const previewStroke =
        preview.value.edge?.color ?? 'var(--board-edge-active-color)'
      const candidateNode = preview.value.candidateNode
      const fixedEnd =
        dragState.value?.mode === 'reconnect' && dragState.value.end === 'from'
          ? preview.value.target
          : preview.value.source
      const dynamicEnd =
        dragState.value?.mode === 'reconnect' && dragState.value.end === 'from'
          ? preview.value.source
          : preview.value.target

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
              stroke: 'var(--board-edge-active-color)',
              'stroke-width': 2 / Math.max(injected.$camera.value.z, 0.25),
              'vector-effect': 'non-scaling-stroke',
              opacity: 0.9,
              style: {
                pointerEvents: 'none',
              },
            })
          : null,
        h('path', {
          d: preview.value.route.path,
          stroke: previewStroke,
          fill: 'none',
          opacity: 0.55,
          'stroke-width': previewStrokeWidth.value,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'vector-effect': 'non-scaling-stroke',
          'marker-end': `url(#${markerId})`,
          color: previewStroke,
          style: {
            pointerEvents: 'none',
          },
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
            pointerEvents: 'none',
          },
        }),
        h('circle', {
          cx: dynamicEnd.point.x,
          cy: dynamicEnd.point.y,
          r: handleRadius.value,
          fill: '#ffffff',
          stroke: 'var(--board-edge-active-color)',
          'stroke-width': 1.5 / Math.max(injected.$camera.value.z, 0.25),
          'vector-effect': 'non-scaling-stroke',
          style: {
            pointerEvents: 'none',
          },
        }),
      ]
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
      const from = entry.edge.fromEnd ?? 'none'
      const to = entry.edge.toEnd ?? 'arrow'
      const directionLabel =
        from === 'none' && to === 'arrow'
          ? '→'
          : from === 'arrow' && to === 'arrow'
            ? '↔'
            : from === 'arrow' && to === 'none'
              ? '←'
              : '—'

      const buttonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        padding: '0',
        border: 'none',
        background: 'transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        lineHeight: '1',
        color: 'var(--board-fg, #0f172a)',
      } as const

      const swatchStyle = (hex: string, active: boolean) =>
        ({
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: hex,
          border: active
            ? '2px solid var(--board-fg, #0f172a)'
            : '1px solid rgba(15, 23, 42, 0.15)',
          cursor: 'pointer',
          padding: '0',
          boxSizing: 'border-box',
        }) as const

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
            padding: '4px 6px',
            background: 'var(--board-node-bg, #ffffff)',
            border: '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
            borderRadius: '10px',
            boxShadow:
              '0 6px 20px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.08)',
            fontSize: '12px',
            color: 'var(--board-fg, #0f172a)',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
            userSelect: 'none',
          },
        },
        [
          h(
            'button',
            {
              'data-board-interactive': 'true',
              type: 'button',
              title: 'Cycle direction',
              style: buttonStyle,
              onClick: (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                cycleDirectionality(edgeId)
              },
            },
            directionLabel,
          ),
          h('span', {
            style: {
              display: 'inline-block',
              width: '1px',
              height: '18px',
              background: 'rgba(15,23,42,0.12)',
              margin: '0 2px',
            },
          }),
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
          h('span', {
            style: {
              display: 'inline-block',
              width: '1px',
              height: '18px',
              background: 'rgba(15,23,42,0.12)',
              margin: '0 2px',
            },
          }),
          h(
            'button',
            {
              'data-board-interactive': 'true',
              type: 'button',
              title: 'Delete',
              style: { ...buttonStyle, color: '#b91c1c' },
              onClick: (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                deleteEdge(edgeId)
              },
            },
            '✕',
          ),
        ],
      )
    }

    function renderSvg() {
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
                markerWidth: 6,
                markerHeight: 6,
                refX: 4.6,
                refY: 3,
                orient: 'auto-start-reverse',
                markerUnits: 'strokeWidth',
                viewBox: '0 0 6 6',
              },
              [
                h('path', {
                  d: 'M0.6,0.6 L5.2,3 L0.6,5.4 L2.1,3 Z',
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
