import { cloneInteraction } from '../invariants.js'
import {
  sameArray,
  freezeClone,
  readonlyMapView,
  readonlySetView,
} from '../helpers/clone.js'
import { createBatchController, createSubscribable } from '../subscribable.js'
import type { BatchController } from '../subscribable.js'
import type {
  BoardEventMap,
  BoardNode,
  Camera,
  GridSettings,
  InteractionState,
  NodeId,
  SnapGuide,
  Subscribable,
} from '../types.js'
import type { MutableBoardState } from '../state/types.js'
import { buildPublicNodeMap } from '../state/selectors.js'

interface ReactiveLayer {
  batchCtrl: BatchController
  $camera: Subscribable<Camera>
  $grid: Subscribable<GridSettings>
  $nodes: Subscribable<ReadonlyMap<NodeId, BoardNode>>
  $selection: Subscribable<ReadonlySet<NodeId>>
  $interaction: Subscribable<InteractionState>
  $snapGuides: Subscribable<readonly SnapGuide[]>
  getPublicNodeMap: () => ReadonlyMap<NodeId, BoardNode>
  invalidateNodeCache: () => void
  notifyNodesChanged: () => void
  notifyCameraChanged: () => void
  notifyGridChanged: () => void
  notifySelectionChanged: () => void
  notifyInteractionChanged: () => void
  notifySnapGuidesChanged: () => void
  setCamera: (next: Camera) => void
  setSelection: (next: Iterable<NodeId>) => void
  setInteraction: (next: InteractionState) => void
  setSnapGuides: (next: SnapGuide[]) => void
  destroy: () => void
}

interface ReactiveLayerDeps {
  getState: () => MutableBoardState
  getGrid: () => GridSettings
  getEffectiveNodes: () => Map<NodeId, BoardNode>
  emit: <K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ) => void
}

export function createReactiveLayer(deps: ReactiveLayerDeps): ReactiveLayer {
  const { getState, getGrid, emit, getEffectiveNodes } = deps
  const initialState = getState()
  const initialGrid = getGrid()

  const batchCtrl = createBatchController()
  const $camera = createSubscribable<Camera>(
    freezeClone({ ...initialState.camera }),
    batchCtrl,
  )
  const $grid = createSubscribable<GridSettings>(
    freezeClone({ ...initialGrid }),
    batchCtrl,
  )
  const $nodes = createSubscribable<ReadonlyMap<NodeId, BoardNode>>(
    readonlyMapView(new Map()),
    batchCtrl,
  )
  const $selection = createSubscribable<ReadonlySet<NodeId>>(
    readonlySetView(new Set(initialState.selection)),
    batchCtrl,
  )
  const $interaction = createSubscribable<InteractionState>(
    cloneInteraction(initialState.interaction),
    batchCtrl,
  )
  const $snapGuides = createSubscribable<readonly SnapGuide[]>(
    initialState.snapGuides.map((guide) => freezeClone({ ...guide })),
    batchCtrl,
  )

  let cachedPublicNodeMap: ReadonlyMap<NodeId, BoardNode> | null = null

  function getPublicNodeMap(): ReadonlyMap<NodeId, BoardNode> {
    if (!cachedPublicNodeMap) {
      cachedPublicNodeMap = buildPublicNodeMap({ nodes: getEffectiveNodes() })
    }
    return cachedPublicNodeMap
  }

  function invalidateNodeCache(): void {
    cachedPublicNodeMap = null
  }

  function notifyNodesChanged(): void {
    cachedPublicNodeMap = null
    if (batchCtrl.depth > 0) {
      batchCtrl.pending.add(publishNodes)
      return
    }
    publishNodes()
  }

  function publishNodes(): void {
    $nodes.set(readonlyMapView(getPublicNodeMap()))
  }

  function notifyCameraChanged(): void {
    $camera.set(freezeClone({ ...getState().camera }))
  }

  function notifyGridChanged(): void {
    $grid.set(freezeClone({ ...getGrid() }))
  }

  function notifySelectionChanged(): void {
    $selection.set(readonlySetView(new Set(getState().selection)))
  }

  function notifyInteractionChanged(): void {
    $interaction.set(cloneInteraction(getState().interaction))
  }

  function notifySnapGuidesChanged(): void {
    $snapGuides.set(
      getState().snapGuides.map((guide) => freezeClone({ ...guide })),
    )
  }

  function setCamera(next: Camera): void {
    const state = getState()
    const prev = { ...state.camera }
    if (prev.x === next.x && prev.y === next.y && prev.z === next.z) return
    state.camera = next
    $camera.set(freezeClone({ ...next }))
    emit('camera:change', freezeClone({ ...next }), freezeClone(prev))
  }

  function setSelection(nextSelection: Iterable<NodeId>): void {
    const state = getState()
    const prev = Array.from(state.selection.values())
    const next = Array.from(nextSelection)
    if (sameArray(prev, next)) return
    state.selection = new Set(next)
    notifySelectionChanged()
    emit('selection:change', next, prev)
  }

  function setInteraction(next: InteractionState): void {
    const state = getState()
    const prev = state.interaction
    state.interaction = next
    notifyInteractionChanged()
    if (prev.mode === 'idle' && next.mode !== 'idle') {
      emit('interaction:start', cloneInteraction(next))
      return
    }
    if (prev.mode !== 'idle' && next.mode === 'idle') {
      emit('interaction:end', cloneInteraction(prev))
      return
    }
    if (prev.mode !== 'idle' && next.mode !== 'idle') {
      emit('interaction:update', cloneInteraction(next))
    }
  }

  function setSnapGuides(next: SnapGuide[]): void {
    const state = getState()
    state.snapGuides = next
    notifySnapGuidesChanged()
  }

  function destroy(): void {
    $camera.destroy()
    $grid.destroy()
    $nodes.destroy()
    $selection.destroy()
    $interaction.destroy()
    $snapGuides.destroy()
    batchCtrl.pending.clear()
    batchCtrl.rollbacks.clear()
  }

  return {
    batchCtrl,
    $camera,
    $grid,
    $nodes,
    $selection,
    $interaction,
    $snapGuides,
    getPublicNodeMap,
    invalidateNodeCache,
    notifyNodesChanged,
    notifyCameraChanged,
    notifyGridChanged,
    notifySelectionChanged,
    notifyInteractionChanged,
    notifySnapGuidesChanged,
    setCamera,
    setSelection,
    setInteraction,
    setSnapGuides,
    destroy,
  }
}
