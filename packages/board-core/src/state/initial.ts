import type { BoardNode } from '../types'
import type { StoredNode } from './versioning'
import { ZERO_VERSIONS } from './versioning'

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
    ...ZERO_VERSIONS,
  }
}
