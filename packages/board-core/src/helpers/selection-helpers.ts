import { expandGroupDragSeeds } from '../hierarchy.js'
import { snapValue } from '../math.js'
import type { BoardNode, GridSettings, NodeId, Point } from '../types.js'
import type { MutableBoardState } from '../state/types.js'
import { createNodeId } from './ids.js'

export function getSelectionNodes(state: MutableBoardState): BoardNode[] {
  return Array.from(state.selection.values())
    .map((id) => state.nodes.get(id))
    .filter((node): node is BoardNode => Boolean(node))
}

export function getCopyClosureNodes(state: MutableBoardState): BoardNode[] {
  const selected = getSelectionNodes(state)
  const ids = expandGroupDragSeeds(
    selected.map((node) => node.id),
    state.nodes as Map<NodeId, BoardNode>,
  )
  return Array.from(ids)
    .map((id) => state.nodes.get(id))
    .filter((node): node is BoardNode => Boolean(node))
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function duplicateForest(
  state: MutableBoardState,
  grid: GridSettings,
  nodes: BoardNode[],
  offset: Point,
): { nodes: BoardNode[]; idMap: ReadonlyMap<NodeId, NodeId> } {
  const sorted = [...nodes].sort((a, b) => a.zIndex - b.zIndex)
  const idMap = new Map<NodeId, NodeId>()
  for (const node of sorted) {
    idMap.set(node.id, createNodeId())
  }
  return {
    nodes: sorted.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      parentId:
        node.parentId && idMap.has(node.parentId)
          ? idMap.get(node.parentId)
          : undefined,
      x: grid.snap
        ? snapValue(node.x + offset.x, grid.size)
        : node.x + offset.x,
      y: grid.snap
        ? snapValue(node.y + offset.y, grid.size)
        : node.y + offset.y,
      zIndex: state.nextZIndex++,
    })),
    idMap,
  }
}
