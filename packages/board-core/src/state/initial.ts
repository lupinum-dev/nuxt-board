import type { BoardNode } from '../types.js'

export function normalizeExistingNode(node: BoardNode): BoardNode {
  const parentId =
    typeof node.parentId === 'string' && node.parentId.length > 0
      ? node.parentId
      : undefined
  return {
    ...node,
    color: node.color,
    locked: Boolean(node.locked),
    visible: node.visible !== false,
    parentId,
  }
}
