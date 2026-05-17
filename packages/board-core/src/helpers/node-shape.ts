import type { BoardNode } from '../types'
import { freezeClone } from './clone'
import type { StoredNode } from '../state/versioning'

export function materializeNode(node: StoredNode): BoardNode {
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
    data: projectNodeData(node),
    zIndex: node.zIndex,
    locked: node.locked,
    visible: node.visible,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
  }) as BoardNode
}

function projectNodeData(node: StoredNode): Record<string, unknown> {
  const existing = node.data ?? {}
  switch (node.type) {
    case 'text':
      return { ...existing, content: node.text ?? '' }
    case 'file':
      return {
        ...existing,
        ...(node.file !== undefined ? { src: node.file } : {}),
        ...(node.file !== undefined ? { file: node.file } : {}),
        ...(node.subpath !== undefined ? { subpath: node.subpath } : {}),
      }
    case 'link':
      return { ...existing, url: node.url ?? '' }
    case 'group':
      return {
        ...existing,
        ...(node.label !== undefined
          ? { title: node.label, label: node.label }
          : {}),
        ...(node.background !== undefined
          ? { background: node.background }
          : {}),
        ...(node.backgroundStyle !== undefined
          ? { backgroundStyle: node.backgroundStyle }
          : {}),
      }
  }
}
