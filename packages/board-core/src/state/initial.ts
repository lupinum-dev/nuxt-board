import type { BoardNode } from '../types'
import type { StoredNode } from './versioning'
import { ZERO_VERSIONS } from './versioning'
import { DEFAULT_CAMERA } from './types'
import type { MutableBoardState } from './types'

export function normalizeExistingNode(node: BoardNode): StoredNode {
  const parentId =
    typeof node.parentId === 'string' && node.parentId.length > 0
      ? node.parentId
      : undefined
  const data = node.data ?? {}
  const normalizedFields =
    node.type === 'text'
      ? {
          text:
            typeof data.content === 'string' ? data.content : (node.text ?? ''),
        }
      : node.type === 'group'
        ? {
            label:
              typeof data.title === 'string'
                ? data.title
                : typeof data.label === 'string'
                  ? data.label
                  : node.label,
          }
        : node.type === 'file'
          ? {
              file:
                typeof data.file === 'string'
                  ? data.file
                  : typeof data.src === 'string'
                    ? data.src
                    : node.file,
            }
          : node.type === 'link'
            ? {
                url: typeof data.url === 'string' ? data.url : node.url,
              }
            : {}
  return {
    ...node,
    ...normalizedFields,
    color: node.color,
    locked: Boolean(node.locked),
    visible: node.visible !== false,
    parentId,
    ...ZERO_VERSIONS,
  }
}

function createInitialState(
  initialNodes: ReadonlyArray<BoardNode> = [],
  cameraOverrides?: Partial<typeof DEFAULT_CAMERA>,
): MutableBoardState {
  const state: MutableBoardState = {
    camera: { ...DEFAULT_CAMERA, ...cameraOverrides },
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 1,
  }
  for (const node of initialNodes) {
    const normalized = normalizeExistingNode(node)
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }
  return state
}
