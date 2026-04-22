import { cloneInteraction } from '../invariants'
import { freezeClone } from '../helpers/clone'
import { materializeNode } from '../helpers/node-shape'
import type {
  BoardSnapshot,
  BoardState,
  GridSettings,
  NodeId,
  NodeTypeRegistry,
  ResolvedNode
} from '../types'
import type { MutableBoardState } from './types'

export function buildPublicNodeMap<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>
): ReadonlyMap<NodeId, ResolvedNode<R>> {
  return new Map(
    Array.from(state.nodes.values(), (node) => [node.id, materializeNode<R>(node)] as const)
  )
}

export function buildSnapshot<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>,
  grid: GridSettings,
  publicNodes: ReadonlyMap<NodeId, ResolvedNode<R>>
): BoardSnapshot<R> {
  return freezeClone({
    camera: { ...state.camera },
    grid: { ...grid },
    nodes: Array.from(publicNodes.values()).sort((a, b) => a.zIndex - b.zIndex),
    selection: Array.from(state.selection.values()),
    interaction: cloneInteraction(state.interaction),
    snapGuides: state.snapGuides.map((guide) => ({ ...guide })),
    nextZIndex: state.nextZIndex
  })
}

export function buildPublicState<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>,
  publicNodes: ReadonlyMap<NodeId, ResolvedNode<R>>
): BoardState<R> {
  return {
    camera: freezeClone({ ...state.camera }),
    nodes: new Map(publicNodes),
    selection: new Set(state.selection),
    interaction: cloneInteraction(state.interaction),
    snapGuides: state.snapGuides.map((guide) => freezeClone({ ...guide })),
    nextZIndex: state.nextZIndex
  }
}
