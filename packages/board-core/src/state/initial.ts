import type { NodeData, NodeTypeRegistry, ResolvedNode } from '../types'
import { cloneData } from '../helpers/clone'
import type { StoredNode } from './versioning'
import { ZERO_VERSIONS } from './versioning'
import { DEFAULT_CAMERA } from './types'
import type { MutableBoardState } from './types'

export function defaultNodeData(type: string): NodeData {
  if (type === 'text') {
    return { content: '' }
  }
  if (type === 'group') {
    return { title: 'Untitled group', accent: '#0d9488' }
  }
  return {}
}

export function normalizeExistingNode<R extends NodeTypeRegistry>(node: ResolvedNode<R>): StoredNode {
  const parentId =
    typeof node.parentId === 'string' && node.parentId.length > 0 ? node.parentId : undefined
  return {
    ...node,
    data: cloneData(node.data),
    locked: Boolean(node.locked),
    visible: node.visible !== false,
    parentId,
    ...ZERO_VERSIONS
  }
}

export function createInitialState<R extends NodeTypeRegistry>(
  initialNodes: ReadonlyArray<ResolvedNode<R>> = [],
  cameraOverrides?: Partial<typeof DEFAULT_CAMERA>
): MutableBoardState<R> {
  const state: MutableBoardState<R> = {
    camera: { ...DEFAULT_CAMERA, ...cameraOverrides },
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 1
  }
  for (const node of initialNodes) {
    const normalized = normalizeExistingNode<R>(node)
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }
  return state
}
