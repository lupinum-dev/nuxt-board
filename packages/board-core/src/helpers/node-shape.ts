import type { BoardNode } from '../types.js'
import { freezeClone } from './clone.js'

export function materializeNode(node: BoardNode): BoardNode {
  return freezeClone({
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.color !== undefined ? { color: node.color } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.file !== undefined ? { file: node.file } : {}),
    ...(node.subpath !== undefined ? { subpath: node.subpath } : {}),
    ...(node.url !== undefined ? { url: node.url } : {}),
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.background !== undefined ? { background: node.background } : {}),
    ...(node.backgroundStyle !== undefined
      ? { backgroundStyle: node.backgroundStyle }
      : {}),
    zIndex: node.zIndex,
    locked: node.locked,
    visible: node.visible,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
  }) as BoardNode
}
