import { cloneInteraction } from '../invariants.js'
import { freezeClone } from '../helpers/clone.js'
import { materializeNode } from '../helpers/node-shape.js'
import type {
  InternalBoardSnapshot,
  BoardState,
  BoardNode,
  GridSettings,
  NodeId,
} from '../types.js'
import type { MutableBoardState } from './types.js'

const materializedNodes = new WeakMap<BoardNode, BoardNode>()

function getMaterializedNode(node: BoardNode): BoardNode {
  const cached = materializedNodes.get(node)
  if (cached) return cached
  const materialized = materializeNode(node)
  materializedNodes.set(node, materialized)
  return materialized
}

export function buildPublicNodeMap(
  state: Pick<MutableBoardState, 'nodes'>,
): ReadonlyMap<NodeId, BoardNode> {
  return new Map(
    Array.from(
      state.nodes.values(),
      (node) => [node.id, getMaterializedNode(node)] as const,
    ),
  )
}

export function buildSnapshot(
  state: MutableBoardState,
  grid: GridSettings,
  publicNodes: ReadonlyMap<NodeId, BoardNode>,
): InternalBoardSnapshot {
  const nodes = Array.from(publicNodes.values()).sort(
    (a, b) => a.zIndex - b.zIndex,
  )
  return freezeClone({
    nodes,
    camera: { ...state.camera },
    grid: { ...grid },
    selection: Array.from(state.selection.values()),
    interaction: cloneInteraction(state.interaction),
    snapGuides: state.snapGuides.map((guide) => ({ ...guide })),
    nextZIndex: state.nextZIndex,
  })
}

export function buildPublicState(
  state: MutableBoardState,
  grid: GridSettings,
  publicNodes: ReadonlyMap<NodeId, BoardNode>,
): BoardState {
  return {
    camera: freezeClone({ ...state.camera }),
    grid: freezeClone({ ...grid }),
    nodes: new Map(publicNodes),
    selection: new Set(state.selection),
    interaction: cloneInteraction(state.interaction),
    snapGuides: state.snapGuides.map((guide) => freezeClone({ ...guide })),
  }
}
