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
  return {
    ...node,
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
