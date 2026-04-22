import { cloneInteraction } from '../invariants'
import { sameArray, freezeClone } from '../helpers/clone'
import { createBatchController, createSubscribable } from '../subscribable'
import type { BatchController } from '../subscribable'
import type {
  BoardEventMap,
  Camera,
  InteractionState,
  NodeId,
  NodeTypeRegistry,
  ResolvedNode,
  SnapGuide,
  Subscribable,
} from '../types'
import type { MutableBoardState } from '../state/types'
import { buildPublicNodeMap } from '../state/selectors'
import type { Action } from '../state/actions'

export interface ReactiveLayer<R extends NodeTypeRegistry> {
  batchCtrl: BatchController
  $camera: Subscribable<Camera>
  $nodes: Subscribable<ReadonlyMap<NodeId, ResolvedNode<R>>>
  $selection: Subscribable<ReadonlySet<NodeId>>
  $interaction: Subscribable<InteractionState>
  $snapGuides: Subscribable<readonly SnapGuide[]>
  getPublicNodeMap: () => ReadonlyMap<NodeId, ResolvedNode<R>>
  invalidateNodeCache: () => void
  notifyNodesChanged: () => void
  notifySelectionChanged: () => void
  notifyInteractionChanged: () => void
  notifySnapGuidesChanged: () => void
  setCamera: (next: Camera) => void
  setSelection: (next: Iterable<NodeId>) => void
  setInteraction: (next: InteractionState) => void
  setSnapGuides: (next: SnapGuide[]) => void
}

export interface ReactiveLayerDeps<R extends NodeTypeRegistry> {
  state: MutableBoardState<R>
  emit: <K extends keyof BoardEventMap<R>>(
    event: K,
    ...args: Parameters<BoardEventMap<R>[K]>
  ) => void
  dispatch: (action: Action) => void
}

export function createReactiveLayer<R extends NodeTypeRegistry>(
  deps: ReactiveLayerDeps<R>,
): ReactiveLayer<R> {
  const { state, emit, dispatch } = deps

  const batchCtrl = createBatchController()
  const $camera = createSubscribable<Camera>(
    freezeClone({ ...state.camera }),
    batchCtrl,
  )
  const $nodes = createSubscribable<ReadonlyMap<NodeId, ResolvedNode<R>>>(
    new Map(),
    batchCtrl,
  )
  const $selection = createSubscribable<ReadonlySet<NodeId>>(
    new Set(state.selection),
    batchCtrl,
  )
  const $interaction = createSubscribable<InteractionState>(
    cloneInteraction(state.interaction),
    batchCtrl,
  )
  const $snapGuides = createSubscribable<readonly SnapGuide[]>(
    state.snapGuides.map((guide) => freezeClone({ ...guide })),
    batchCtrl,
  )

  let cachedPublicNodeMap: ReadonlyMap<NodeId, ResolvedNode<R>> | null = null

  function getPublicNodeMap(): ReadonlyMap<NodeId, ResolvedNode<R>> {
    if (!cachedPublicNodeMap) {
      cachedPublicNodeMap = buildPublicNodeMap<R>(state)
    }
    return cachedPublicNodeMap
  }

  function invalidateNodeCache(): void {
    cachedPublicNodeMap = null
  }

  function notifyNodesChanged(): void {
    cachedPublicNodeMap = null
    $nodes.set(new Map(getPublicNodeMap()))
  }

  function notifySelectionChanged(): void {
    $selection.set(new Set(state.selection))
  }

  function notifyInteractionChanged(): void {
    $interaction.set(cloneInteraction(state.interaction))
  }

  function notifySnapGuidesChanged(): void {
    $snapGuides.set(state.snapGuides.map((guide) => freezeClone({ ...guide })))
  }

  function setCamera(next: Camera): void {
    const prev = { ...state.camera }
    if (prev.x === next.x && prev.y === next.y && prev.z === next.z) return
    state.camera = next
    $camera.set(freezeClone({ ...next }))
    emit('camera:change', freezeClone({ ...next }), freezeClone(prev))
  }

  function setSelection(nextSelection: Iterable<NodeId>): void {
    const prev = Array.from(state.selection.values())
    const next = Array.from(nextSelection)
    if (sameArray(prev, next)) return
    state.selection = new Set(next)
    notifySelectionChanged()
    dispatch({ type: 'SELECTION_SET', before: prev, after: next })
    emit('selection:change', next, prev)
  }

  function setInteraction(next: InteractionState): void {
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
    state.snapGuides = next
    notifySnapGuidesChanged()
  }

  return {
    batchCtrl,
    $camera,
    $nodes,
    $selection,
    $interaction,
    $snapGuides,
    getPublicNodeMap,
    invalidateNodeCache,
    notifyNodesChanged,
    notifySelectionChanged,
    notifyInteractionChanged,
    notifySnapGuidesChanged,
    setCamera,
    setSelection,
    setInteraction,
    setSnapGuides,
  }
}
