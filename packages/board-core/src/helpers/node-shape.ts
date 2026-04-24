import type { NodeTypeRegistry, ResolvedNode } from '../types'
import { cloneData, freezeClone } from './clone'
import type { StoredNode } from '../state/versioning'

export function materializeNode<
  R extends NodeTypeRegistry,
  T extends keyof R = keyof R,
>(node: StoredNode): ResolvedNode<R, T> {
  return freezeClone({
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    data: cloneData(node.data),
    ...(node.color !== undefined ? { color: node.color } : {}),
    zIndex: node.zIndex,
    locked: node.locked,
    visible: node.visible,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
  }) as ResolvedNode<R, T>
}
