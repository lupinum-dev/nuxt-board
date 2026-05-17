import { cloneInteraction } from '../invariants'
import { freezeClone } from '../helpers/clone'
import { materializeNode } from '../helpers/node-shape'
import type {
  BoardSnapshot,
  BoardState,
  BoardNode,
  JsonCanvasNode,
  GridSettings,
  NodeId,
} from '../types'
import type { MutableBoardState } from './types'

export function buildPublicNodeMap(
  state: MutableBoardState,
): ReadonlyMap<NodeId, BoardNode> {
  return new Map(
    Array.from(
      state.nodes.values(),
      (node) => [node.id, materializeNode(node)] as const,
    ),
  )
}

export function buildSnapshot(
  state: MutableBoardState,
  grid: GridSettings,
  publicNodes: ReadonlyMap<NodeId, BoardNode>,
): BoardSnapshot {
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

function toJsonCanvasNode(node: BoardNode): JsonCanvasNode {
  const base = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.color !== undefined ? { color: node.color } : {}),
  }
  switch (node.type) {
    case 'file':
      return {
        ...base,
        type: 'file',
        file: node.file ?? '',
        ...(node.subpath !== undefined ? { subpath: node.subpath } : {}),
      }
    case 'link':
      return { ...base, type: 'link', url: node.url ?? '' }
    case 'group':
      return {
        ...base,
        type: 'group',
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.background !== undefined
          ? { background: node.background }
          : {}),
        ...(node.backgroundStyle !== undefined
          ? { backgroundStyle: node.backgroundStyle }
          : {}),
      }
    case 'text':
    default:
      return { ...base, type: 'text', text: node.text ?? '' }
  }
}

export function buildPublicState(
  state: MutableBoardState,
  publicNodes: ReadonlyMap<NodeId, BoardNode>,
): BoardState {
  return {
    camera: freezeClone({ ...state.camera }),
    nodes: new Map(publicNodes),
    selection: new Set(state.selection),
    interaction: cloneInteraction(state.interaction),
    snapGuides: state.snapGuides.map((guide) => freezeClone({ ...guide })),
    nextZIndex: state.nextZIndex,
  }
}
