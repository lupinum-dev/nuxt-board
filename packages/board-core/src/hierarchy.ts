import { boundsContain } from './math.js'
import type { Bounds, BoardNode, NodeId } from './types.js'

export function getBoundsFromNode(
  node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
): Bounds {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + node.width,
    maxY: node.y + node.height,
  }
}

export function groupArea(node: BoardNode): number {
  return node.width * node.height
}

/** Add every descendant of `rootId` into `out` (recursive; includes nested groups). */
export function addDescendants(
  rootId: NodeId,
  nodes: Map<NodeId, BoardNode>,
  out: Set<NodeId>,
): void {
  for (const n of nodes.values()) {
    if (n.parentId === rootId && !out.has(n.id)) {
      out.add(n.id)
      if (n.type === 'group') {
        addDescendants(n.id, nodes, out)
      }
    }
  }
}

export function expandGroupDragSeeds(
  seedIds: Iterable<NodeId>,
  nodes: Map<NodeId, BoardNode>,
): Set<NodeId> {
  const out = new Set<NodeId>()
  for (const id of seedIds) {
    out.add(id)
    const n = nodes.get(id)
    if (n?.type === 'group') {
      addDescendants(id, nodes, out)
    }
  }
  return out
}

export function collectSubtreeIds(
  rootId: NodeId,
  nodes: Map<NodeId, BoardNode>,
  into: Set<NodeId>,
): void {
  into.add(rootId)
  for (const n of nodes.values()) {
    if (n.parentId === rootId) {
      collectSubtreeIds(n.id, nodes, into)
    }
  }
}

/**
 * Seeds expanded with group descendants, then union of subtrees rooted at nodes whose parent is outside the expanded set.
 * Each node appears once; applying the same delta to all ids moves a coherent forest.
 */
export function collectUniformTranslationTargets(
  seedIds: Iterable<NodeId>,
  nodes: Map<NodeId, BoardNode>,
): NodeId[] {
  const expanded = expandGroupDragSeeds(seedIds, nodes)
  const roots: NodeId[] = []
  for (const id of expanded) {
    const n = nodes.get(id)
    if (!n) {
      continue
    }
    if (!n.parentId || !expanded.has(n.parentId)) {
      roots.push(id)
    }
  }
  const out = new Set<NodeId>()
  for (const r of roots) {
    collectSubtreeIds(r, nodes, out)
  }
  return [...out]
}

/** True if `maybeDescendant` is reachable by following parentId from `maybeDescendant` up to `ancestorId`. */
export function isStrictDescendantOf(
  maybeDescendant: NodeId,
  ancestorId: NodeId,
  nodes: Map<NodeId, BoardNode>,
): boolean {
  let walk = nodes.get(maybeDescendant)?.parentId
  const seen = new Set<NodeId>()
  while (walk) {
    if (seen.has(walk)) {
      return false
    }
    seen.add(walk)
    if (walk === ancestorId) {
      return true
    }
    walk = nodes.get(walk)?.parentId
  }
  return false
}

export function findContainingGroup(
  node: BoardNode,
  nodes: Map<NodeId, BoardNode>,
): NodeId | undefined {
  const nodeBounds = getBoundsFromNode(node)
  const candidates: BoardNode[] = []
  for (const g of nodes.values()) {
    if (g.type !== 'group' || !g.visible) {
      continue
    }
    if (g.id === node.id) {
      continue
    }
    if (isStrictDescendantOf(g.id, node.id, nodes)) {
      continue
    }
    if (!boundsContain(getBoundsFromNode(g), nodeBounds)) {
      continue
    }
    candidates.push(g)
  }
  if (candidates.length === 0) {
    return undefined
  }
  candidates.sort((a, b) => groupArea(a) - groupArea(b))
  return candidates[0]!.id
}

export function sortIdsByZIndex(
  ids: NodeId[],
  nodes: Map<NodeId, BoardNode>,
): NodeId[] {
  return [...ids].sort((a, b) => {
    const za = nodes.get(a)?.zIndex ?? 0
    const zb = nodes.get(b)?.zIndex ?? 0
    return za - zb
  })
}
