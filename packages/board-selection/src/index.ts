import type {
  Bounds,
  BoardEngine,
  BoardNode,
  NodeId,
} from '@lupinum/board-core'

/** Return the currently selected nodes in snapshot order. */
export function getSelectionNodes(engine: BoardEngine): BoardNode[] {
  const selected = new Set(engine.getSelection())
  return Array.from(engine.getState().nodes.values()).filter((node) =>
    selected.has(node.id),
  )
}

/** Compute the bounding box of the current selection, or `null` when empty. */
export function getSelectionBounds(engine: BoardEngine): Bounds | null {
  const nodes = getSelectionNodes(engine)
  if (nodes.length === 0) {
    return null
  }
  return {
    minX: Math.min(...nodes.map((node) => node.x)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height)),
  }
}

/** Toggle a list of ids in an existing selection array. */
export function toggleIds(current: NodeId[], ids: NodeId[]): NodeId[] {
  const next = new Set(current)
  for (const id of ids) {
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
  }
  return Array.from(next)
}
