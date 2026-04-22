import { expandGroupDragSeeds } from '../hierarchy'
import { snapValue } from '../math'
import type {
  BoardNode,
  GridSettings,
  NodeId,
  NodeTypeRegistry,
  Point,
} from '../types'
import type { StoredNode } from '../state/versioning'
import { ZERO_VERSIONS } from '../state/versioning'
import type { MutableBoardState } from '../state/types'
import { cloneData } from './clone'
import { createNodeId } from './ids'

export function getSelectionNodes<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>,
): StoredNode[] {
  return Array.from(state.selection.values())
    .map((id) => state.nodes.get(id))
    .filter((node): node is StoredNode => Boolean(node))
}

export function getCopyClosureNodes<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>,
): StoredNode[] {
  const selected = getSelectionNodes(state)
  const ids = expandGroupDragSeeds(
    selected.map((node) => node.id),
    state.nodes as Map<NodeId, BoardNode>,
  )
  return Array.from(ids)
    .map((id) => state.nodes.get(id))
    .filter((node): node is StoredNode => Boolean(node))
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function duplicateForest<R extends NodeTypeRegistry>(
  state: MutableBoardState<R>,
  grid: GridSettings,
  nodes: StoredNode[],
  offset: Point,
): StoredNode[] {
  const sorted = [...nodes].sort((a, b) => a.zIndex - b.zIndex)
  const idMap = new Map<NodeId, NodeId>()
  for (const node of sorted) {
    idMap.set(node.id, createNodeId())
  }
  return sorted.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    data: cloneData(node.data),
    parentId:
      node.parentId && idMap.has(node.parentId)
        ? idMap.get(node.parentId)
        : undefined,
    x: grid.snap ? snapValue(node.x + offset.x, grid.size) : node.x + offset.x,
    y: grid.snap ? snapValue(node.y + offset.y, grid.size) : node.y + offset.y,
    zIndex: state.nextZIndex++,
    ...ZERO_VERSIONS,
  }))
}
