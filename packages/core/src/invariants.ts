import type { BoardState, CanvasEngineSnapshot, InvariantFailure } from './types'

export function createInvariantSnapshot(state: BoardState): CanvasEngineSnapshot {
  return {
    camera: { ...state.camera },
    nodes: Array.from(state.nodes.values())
      .map((node) => ({ ...node }))
      .sort((a, b) => a.zIndex - b.zIndex),
    selection: Array.from(state.selection.values()),
    interaction: cloneInteraction(state.interaction),
    nextZIndex: state.nextZIndex
  }
}

function cloneInteraction(state: BoardState['interaction']): BoardState['interaction'] {
  switch (state.mode) {
    case 'idle':
      return { mode: 'idle' }
    case 'editing-text':
      return { mode: 'editing-text', nodeId: state.nodeId }
    case 'panning':
      return { mode: 'panning', pointerId: state.pointerId, lastScreenPoint: { ...state.lastScreenPoint } }
    case 'dragging-node':
      return {
        mode: 'dragging-node',
        pointerId: state.pointerId,
        nodeId: state.nodeId,
        lastScreenPoint: { ...state.lastScreenPoint }
      }
    case 'resizing-node':
      return {
        mode: 'resizing-node',
        pointerId: state.pointerId,
        nodeId: state.nodeId,
        handle: state.handle,
        startScreenPoint: { ...state.startScreenPoint },
        startNodeBounds: { ...state.startNodeBounds }
      }
  }
}

export function validateState(state: BoardState, context: string): InvariantFailure[] {
  const failures: InvariantFailure[] = []
  const snapshot = createInvariantSnapshot(state)

  const push = (name: string, message: string) => {
    failures.push({ name, message, context, snapshot })
  }

  if (!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y) || !Number.isFinite(state.camera.z)) {
    push('camera.finite', 'Camera values must always be finite numbers.')
  }

  const zIndexes = new Set<number>()
  for (const node of state.nodes.values()) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
      push('node.finite', `Node ${node.id} contains non-finite geometry.`)
    }

    if (node.width < 1 || node.height < 1) {
      push('node.size', `Node ${node.id} must have positive width and height.`)
    }

    if (zIndexes.has(node.zIndex)) {
      push('node.zindex.unique', `Node ${node.id} shares a z-index with another node.`)
    }
    zIndexes.add(node.zIndex)
  }

  for (const id of state.selection.values()) {
    if (!state.nodes.has(id)) {
      push('selection.exists', `Selected node ${id} does not exist.`)
    }
  }

  if (state.nextZIndex <= state.nodes.size) {
    const maxZ = Math.max(0, ...Array.from(state.nodes.values(), (node) => node.zIndex))
    if (state.nextZIndex <= maxZ) {
      push('node.zindex.monotonic', 'nextZIndex must stay above every current node z-index.')
    }
  }

  if (state.interaction.mode === 'dragging-node' || state.interaction.mode === 'resizing-node' || state.interaction.mode === 'editing-text') {
    if (!state.nodes.has(state.interaction.nodeId)) {
      push('interaction.node', `Active interaction references missing node ${state.interaction.nodeId}.`)
    }
  }

  return failures
}
