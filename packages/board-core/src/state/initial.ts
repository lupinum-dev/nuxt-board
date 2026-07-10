import type { BoardNode } from '../types.js'
import type { StoredNode } from './versioning.js'

export function normalizeExistingNode(node: BoardNode): StoredNode {
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
