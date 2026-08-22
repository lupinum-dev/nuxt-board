import { shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import {
  isBoardInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '@lupinum/board-core/internal'
import type { NodeId } from '@lupinum/board-core'
import type { useBoardEngine } from '@lupinum/vue-board'
import {
  edgeIdFromTarget,
  nodeHandleFromTarget,
  resolveNodeHandleAtWorldPoint,
  type ConnectionNodeHandle,
} from './hit-testing.js'
import { worldPointFromClient } from './layer-helpers.js'
import type {
  ConnectionDragState,
  PendingConnectionDrag,
} from './controller.js'
import type { ConnectionEngine } from './connection-engine.js'

type BoardContext = ReturnType<typeof useBoardEngine>
type ConnectionMenu = {
  kind: 'color' | 'direction'
  edgeId: string
}

export function createConnectionSelectionState() {
  return {
    hoveredEdgeId: shallowRef<string | null>(null),
    hoveredNodeId: shallowRef<NodeId | null>(null),
    hoveredNodeHandle: shallowRef<ConnectionNodeHandle | null>(null),
    selectedEdgeId: shallowRef<string | null>(null),
    openMenu: shallowRef<ConnectionMenu | null>(null),
  }
}

interface ConnectionSelectionEventsOptions {
  injected: BoardContext
  engine: ComputedRef<ConnectionEngine>
  state: ReturnType<typeof createConnectionSelectionState>
  pendingDrag: Ref<PendingConnectionDrag | null>
  dragState: Ref<ConnectionDragState | null>
  editingEdgeId: Ref<string | null>
  hotspotThickness: ComputedRef<number>
  hotspotCornerClearance: ComputedRef<number>
  commitLabelEdit(): void
  deleteEdge(edgeId: string): void
}

/** Bind hover, selection, menus, and keyboard ownership to the exact board root. */
export function useConnectionSelectionEvents(
  options: ConnectionSelectionEventsOptions,
): void {
  const { injected, engine, state, pendingDrag, dragState } = options

  watch(
    () => injected.rootElement.value,
    (root, _previous, onCleanup) => {
      if (!root) return

      const handlePointerDown = (event: PointerEvent) => {
        if (!isEventOwnedByBoardRoot(event.target, root)) return
        if (dragState.value || pendingDrag.value) return
        if (isBoardInteractiveEventTarget(event.target)) return
        state.selectedEdgeId.value = null
        state.hoveredEdgeId.value = null
        state.hoveredNodeHandle.value = null
        state.openMenu.value = null
        options.commitLabelEdit()
      }

      const handlePointerMove = (event: PointerEvent) => {
        if (!isEventOwnedByBoardRoot(event.target, root)) return
        if (dragState.value || pendingDrag.value) return
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
            options.hotspotThickness.value,
            options.hotspotCornerClearance.value,
          )

        state.hoveredEdgeId.value = edgeId ?? state.selectedEdgeId.value ?? null
        state.hoveredNodeHandle.value = edgeId ? null : nodeHandle
        state.hoveredNodeId.value = nodeUnderCursor?.id ?? null
      }

      const handlePointerLeave = () => {
        if (
          !dragState.value &&
          !pendingDrag.value &&
          !state.selectedEdgeId.value
        ) {
          state.hoveredEdgeId.value = null
          state.hoveredNodeHandle.value = null
        }
        state.hoveredNodeId.value = null
      }

      root.addEventListener('pointerdown', handlePointerDown)
      root.addEventListener('pointermove', handlePointerMove)
      root.addEventListener('pointerleave', handlePointerLeave)
      onCleanup(() => {
        root.removeEventListener('pointerdown', handlePointerDown)
        root.removeEventListener('pointermove', handlePointerMove)
        root.removeEventListener('pointerleave', handlePointerLeave)
      })
    },
    { immediate: true },
  )

  watch(
    [state.selectedEdgeId, () => injected.rootElement.value],
    (_next, _previous, onCleanup) => {
      if (!state.selectedEdgeId.value) return
      const root = injected.rootElement.value
      if (!root) return

      const handleKey = (event: KeyboardEvent) => {
        if (!isEventOwnedByBoardRoot(event.target, root)) return
        const id = state.selectedEdgeId.value
        if (!id || options.editingEdgeId.value) return
        if (isBoardInteractiveEventTarget(event.target)) return
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          options.deleteEdge(id)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          state.openMenu.value = null
          state.selectedEdgeId.value = null
          state.hoveredEdgeId.value = null
        }
      }

      root.addEventListener('keydown', handleKey)
      onCleanup(() => root.removeEventListener('keydown', handleKey))
    },
  )
}
