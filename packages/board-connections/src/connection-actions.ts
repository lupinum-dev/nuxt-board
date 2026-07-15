import { nextTick, type Ref } from 'vue'
import {
  CommandBlockedError,
  type BoardEngine,
  type BoardNode,
} from '@lupinum/board-core'
import { edgeEndsForDirectionality } from './directionality.js'
import { sameAnchor } from './layer-helpers.js'
import type { ConnectionNodeHandle } from './hit-testing.js'
import type {
  ConnectionDragState,
  CreateDragState,
  DragEnd,
  ReconnectDragState,
} from './controller.js'
import type {
  BoardEdge,
  ConnectionEndpointMode,
  ConnectionsApi,
  ConnectionsEventMap,
  CreateNodeForConnectionContext,
} from './types.js'

type ConnectionEngine = BoardEngine<
  { connections: ConnectionsApi },
  ConnectionsEventMap
>

interface ConnectionActionsState {
  hoveredEdgeId: Ref<string | null>
  hoveredNodeHandle: Ref<ConnectionNodeHandle | null>
  selectedEdgeId: Ref<string | null>
  editingEdgeId: Ref<string | null>
  labelDraft: Ref<string>
  colorMenuEdgeId: Ref<string | null>
  directionMenuEdgeId: Ref<string | null>
}

interface ConnectionActionsDeps {
  getEngine(): ConnectionEngine
  getEntry(edgeId: string): { edge: BoardEdge } | undefined
  getRootElement(): HTMLElement | null
  getEndpointMode(): ConnectionEndpointMode
  createNodeForConnection():
    ((context: CreateNodeForConnectionContext) => BoardNode | null) | null
  state: ConnectionActionsState
}

function runConnectionCommand<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch (error) {
    if (error instanceof CommandBlockedError) return undefined
    throw error
  }
}

/** Own edge editing and commit policy; the Vue layer only wires input/rendering. */
export function createConnectionActions(deps: ConnectionActionsDeps) {
  const state = deps.state

  function onEdgePointerDown(edgeId: string, event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()
    if (state.editingEdgeId.value && state.editingEdgeId.value !== edgeId) {
      commitLabelEdit()
    }
    state.selectedEdgeId.value = edgeId
    state.hoveredEdgeId.value = edgeId
    state.hoveredNodeHandle.value = null
  }

  function beginLabelEdit(edgeId: string): void {
    const entry = deps.getEntry(edgeId)
    if (!entry) return
    state.selectedEdgeId.value = edgeId
    state.hoveredEdgeId.value = edgeId
    state.editingEdgeId.value = edgeId
    state.labelDraft.value = entry.edge.label ?? ''
    nextTick(() => {
      const input =
        deps
          .getRootElement()
          ?.querySelector<HTMLInputElement>(
            `[data-connection-label-input="${edgeId}"]`,
          ) ?? null
      input?.focus()
      input?.select()
    })
  }

  function commitLabelEdit(): void {
    const id = state.editingEdgeId.value
    if (!id) return
    const entry = deps.getEntry(id)
    state.editingEdgeId.value = null
    if (!entry) return
    const next = state.labelDraft.value.trim()
    if (next === (entry.edge.label ?? '')) return
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.updateEdge(entry.edge.id, {
        label: next || undefined,
      }),
    )
  }

  function clearLabel(edgeId: string): void {
    const entry = deps.getEntry(edgeId)
    if (!entry?.edge.label) return
    if (state.editingEdgeId.value === edgeId) {
      state.editingEdgeId.value = null
    }
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.updateEdge(entry.edge.id, {
        label: undefined,
      }),
    )
  }

  function cancelLabelEdit(): void {
    state.editingEdgeId.value = null
    state.labelDraft.value = ''
  }

  function setDirectionality(
    edgeId: string,
    direction: 'none' | 'to' | 'both',
  ): void {
    const entry = deps.getEntry(edgeId)
    if (!entry) return
    const next = edgeEndsForDirectionality(
      direction === 'to' ? 'end' : direction,
    )
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.updateEdge(entry.edge.id, {
        fromEnd: next.fromEnd,
        toEnd: next.toEnd,
      }),
    )
    state.directionMenuEdgeId.value = null
  }

  function applyEdgeColor(edgeId: string, color: string | undefined): void {
    const entry = deps.getEntry(edgeId)
    if (!entry) return
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.updateEdge(entry.edge.id, { color }),
    )
    state.colorMenuEdgeId.value = null
  }

  function resetEndpointAnchor(edgeId: string, end: DragEnd | 'both'): void {
    const entry = deps.getEntry(edgeId)
    if (!entry) return
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.updateEdge(entry.edge.id, {
        ...(end === 'from' || end === 'both' ? { fromAnchor: undefined } : {}),
        ...(end === 'to' || end === 'both' ? { toAnchor: undefined } : {}),
      }),
    )
  }

  function deleteEdge(edgeId: string): void {
    const entry = deps.getEntry(edgeId)
    if (!entry) return
    for (const ref of [
      state.editingEdgeId,
      state.selectedEdgeId,
      state.hoveredEdgeId,
      state.colorMenuEdgeId,
      state.directionMenuEdgeId,
    ]) {
      if (ref.value === edgeId) ref.value = null
    }
    runConnectionCommand(() =>
      deps.getEngine().plugins.connections.deleteEdge(entry.edge.id),
    )
  }

  function commitReconnect(active: ReconnectDragState): void {
    const entry = deps.getEntry(active.edgeId)
    if (!entry || !active.candidateNodeId) return
    const nodeId = active.candidateNodeId
    const connections = deps.getEngine().plugins.connections
    if (active.end === 'from') {
      if (
        entry.edge.from === nodeId &&
        sameAnchor(entry.edge.fromAnchor, active.candidateAnchor)
      ) {
        return
      }
      runConnectionCommand(() =>
        connections.updateEdge(entry.edge.id, {
          from: nodeId,
          fromAnchor: active.candidateAnchor ?? undefined,
        }),
      )
      return
    }
    if (
      entry.edge.to === nodeId &&
      sameAnchor(entry.edge.toAnchor, active.candidateAnchor)
    ) {
      return
    }
    runConnectionCommand(() =>
      connections.updateEdge(entry.edge.id, {
        to: nodeId,
        toAnchor: active.candidateAnchor ?? undefined,
      }),
    )
  }

  function commitCreate(active: CreateDragState): void {
    const engine = deps.getEngine()
    const sourceNode = engine.findNode(active.sourceNodeId)
    if (!sourceNode) return
    const targetNode = active.candidateNodeId
      ? engine.findNode(active.candidateNodeId)
      : deps.createNodeForConnection()?.({
          sourceNodeId: active.sourceNodeId,
          sourceSide: active.sourceSide,
          pointerWorld: { ...active.pointerWorld },
          candidateAnchor: active.candidateAnchor
            ? { ...active.candidateAnchor }
            : null,
        })
    if (!targetNode) return
    const created = runConnectionCommand(() =>
      engine.plugins.connections.createEdge({
        from: sourceNode.id,
        to: targetNode.id,
        fromAnchor:
          deps.getEndpointMode() === 'manual'
            ? { side: active.sourceSide, offset: 0.5 }
            : undefined,
        toAnchor:
          deps.getEndpointMode() === 'manual' && active.candidateAnchor
            ? active.candidateAnchor
            : undefined,
        data: {},
      }),
    )
    if (!created) return
    state.selectedEdgeId.value = String(created.id)
    state.hoveredEdgeId.value = String(created.id)
  }

  function commitDrag(active: ConnectionDragState): void {
    if (active.mode === 'reconnect') commitReconnect(active)
    else commitCreate(active)
  }

  return {
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
  }
}
