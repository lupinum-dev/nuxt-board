import { watch, type ComputedRef, type Ref } from 'vue'
import type { NodeId } from '@lupinum/board-core'
import type { useBoardEngine } from '@lupinum/vue-board'
import {
  advanceConnectionDrag,
  type ConnectionDragState,
  type DragEnd,
  type PendingConnectionDrag,
} from './controller.js'
import { resolveNodeHandleAtWorldPoint } from './hit-testing.js'
import {
  CONNECTION_DRAG_THRESHOLD,
  worldPointFromClient,
} from './layer-helpers.js'
import type { AnchorSide } from './types.js'
import type { ConnectionEngine } from './connection-engine.js'
import type { EdgeRenderEntry } from './connection-render-state.js'
import type { createConnectionSelectionState } from './connection-selection.js'

type BoardContext = ReturnType<typeof useBoardEngine>

interface ConnectionDragOptions {
  injected: BoardContext
  engine: ComputedRef<ConnectionEngine>
  selection: ReturnType<typeof createConnectionSelectionState>
  pendingDrag: Ref<PendingConnectionDrag | null>
  dragState: Ref<ConnectionDragState | null>
  hotspotThickness: ComputedRef<number>
  hotspotCornerClearance: ComputedRef<number>
  commitDrag(active: ConnectionDragState): void
}

/** Own the complete pointer lifecycle for create and reconnect drags. */
export function useConnectionDrag(options: ConnectionDragOptions) {
  const { injected, engine, selection, pendingDrag, dragState } = options

  function capture(event: PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as Element | null)?.setPointerCapture?.(
      event.pointerId,
    )
    return worldPointFromClient(
      injected,
      engine.value,
      event.clientX,
      event.clientY,
    )
  }

  function beginReconnectDrag(
    entry: EdgeRenderEntry,
    end: DragEnd,
    event: PointerEvent,
  ): void {
    const startWorld = capture(event)
    selection.selectedEdgeId.value = String(entry.edge.id)
    selection.hoveredEdgeId.value = String(entry.edge.id)
    selection.hoveredNodeHandle.value = null
    pendingDrag.value = {
      mode: 'reconnect',
      edgeId: String(entry.edge.id),
      end,
      pointerId: event.pointerId,
      startWorld,
    }
  }

  function beginCreateDrag(
    nodeId: NodeId,
    side: AnchorSide,
    event: PointerEvent,
  ): void {
    const startWorld = capture(event)
    selection.hoveredEdgeId.value = null
    selection.selectedEdgeId.value = null
    selection.hoveredNodeHandle.value = { nodeId, side, offset: 0.5 }
    pendingDrag.value = {
      mode: 'create',
      sourceNodeId: nodeId,
      sourceSide: side,
      pointerId: event.pointerId,
      startWorld,
    }
  }

  watch([pendingDrag, dragState], ([pending, active], _previous, onCleanup) => {
    if (!pending && !active) return

    const handleMove = (event: PointerEvent) => {
      const currentPending = pendingDrag.value
      const currentActive = dragState.value
      const pointerId = currentActive?.pointerId ?? currentPending?.pointerId
      if (pointerId === undefined || event.pointerId !== pointerId) return

      const currentEngine = engine.value
      const pointerWorld = worldPointFromClient(
        injected,
        currentEngine,
        event.clientX,
        event.clientY,
      )
      const candidateHandle = resolveNodeHandleAtWorldPoint(
        injected.$nodes.value.values(),
        pointerWorld,
        options.hotspotThickness.value,
        options.hotspotCornerClearance.value,
      )
      const candidateNode = candidateHandle
        ? currentEngine.findNode(candidateHandle.nodeId)
        : currentEngine.getNodeAt(pointerWorld)
      const next = advanceConnectionDrag({
        pending: currentPending,
        active: currentActive,
        pointerId: event.pointerId,
        pointerWorld,
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
      if (pendingDrag.value?.pointerId === event.pointerId) {
        pendingDrag.value = null
        return
      }
      if (dragState.value?.pointerId !== event.pointerId) return
      options.commitDrag(dragState.value)
      dragState.value = null
    }

    const handleCancel = (event: PointerEvent) => {
      if (pendingDrag.value?.pointerId === event.pointerId) {
        pendingDrag.value = null
      }
      if (dragState.value?.pointerId === event.pointerId) dragState.value = null
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

  return { beginReconnectDrag, beginCreateDrag }
}
