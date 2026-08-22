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
import { type BoardNode, type NodeId } from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'
import { resolveAnchorPoint } from './geometry.js'
import type {
  AnchorPosition,
  AnchorSide,
  ConnectionEndpointMode,
  CreateNodeForConnectionContext,
  ConnectionRouting,
  ResolvedConnectionEndpoint,
} from './types.js'

import {
  EDGE_ARROW_MARKER_SIZE,
  EDGE_STROKE_LOD_FADE_START,
  EDGE_STROKE_LOD_SOFTEN_AT,
  resolveArrowScreenSize,
  resolveLodAmount,
} from './layer-helpers.js'
import { sameEdgeTarget } from './hit-testing.js'
import {
  type ConnectionDragState,
  type DragEnd,
  type PendingConnectionDrag,
} from './controller.js'
import { renderConnectionPreview, renderDefaultEdgePath } from './renderer.js'
import { ConnectionLabel } from './connection-label.js'
import { renderConnectionToolbar } from './connection-toolbar.js'
import { createConnectionActions } from './connection-actions.js'
import { resolveConnectionEngine } from './connection-engine.js'
import {
  useConnectionRenderState,
  type EdgeRenderEntry,
} from './connection-render-state.js'
import {
  createConnectionSelectionState,
  useConnectionSelectionEvents,
} from './connection-selection.js'
import { useConnectionDrag } from './connection-drag.js'

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
    const engine = computed(() => resolveConnectionEngine(injected.engine))
    const markerId = `board-connection-arrow-${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`
    const selectionState = createConnectionSelectionState()
    const {
      hoveredEdgeId,
      hoveredNodeId,
      hoveredNodeHandle,
      selectedEdgeId,
      openMenu,
    } = selectionState
    const pendingDrag = shallowRef<PendingConnectionDrag | null>(null)
    const dragState = shallowRef<ConnectionDragState | null>(null)
    const editingEdgeId = shallowRef<string | null>(null)
    const labelDraft = shallowRef<string>('')
    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches

    const endpointMode = computed<ConnectionEndpointMode>(
      () =>
        props.endpointMode ??
        engine.value.plugins.connections.getConfig().endpointMode,
    )
    const { entries, entryById, preview } = useConnectionRenderState({
      injected,
      engine,
      routing: () => props.routing,
      endpointMode,
      selectedEdgeId,
      dragState,
    })

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
        openMenu,
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
    useConnectionSelectionEvents({
      injected,
      engine,
      state: selectionState,
      pendingDrag,
      dragState,
      editingEdgeId,
      hotspotThickness,
      hotspotCornerClearance,
      commitLabelEdit,
      deleteEdge,
    })
    const { beginReconnectDrag, beginCreateDrag } = useConnectionDrag({
      injected,
      engine,
      selection: selectionState,
      pendingDrag,
      dragState,
      hotspotThickness,
      hotspotCornerClearance,
      commitDrag,
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
        colorMenuOpen:
          openMenu.value?.kind === 'color' && openMenu.value.edgeId === edgeId,
        directionMenuOpen:
          openMenu.value?.kind === 'direction' &&
          openMenu.value.edgeId === edgeId,
        onDelete: () => deleteEdge(edgeId),
        onToggleColorMenu: () => {
          openMenu.value =
            openMenu.value?.kind === 'color' && openMenu.value.edgeId === edgeId
              ? null
              : { kind: 'color', edgeId }
        },
        onToggleDirectionMenu: () => {
          openMenu.value =
            openMenu.value?.kind === 'direction' &&
            openMenu.value.edgeId === edgeId
              ? null
              : { kind: 'direction', edgeId }
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
