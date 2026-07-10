import type {
  BoardState,
  BoardNode,
  GridSettings,
  ValidationFailure,
  InteractionState,
  NodeId,
} from './types.js'

export function cloneInteraction(
  interaction: InteractionState,
): InteractionState {
  switch (interaction.mode) {
    case 'idle':
      return { mode: 'idle' }
    case 'editing-text':
      return { mode: 'editing-text', nodeId: interaction.nodeId }
    case 'panning':
      return {
        mode: 'panning',
        pointerId: interaction.pointerId,
        lastScreenPoint: { ...interaction.lastScreenPoint },
      }
    case 'dragging-nodes':
      return {
        mode: 'dragging-nodes',
        pointerId: interaction.pointerId,
        nodeIds: [...interaction.nodeIds],
        startScreenPoint: { ...interaction.startScreenPoint },
        startNodePositions: Object.fromEntries(
          Object.entries(interaction.startNodePositions).map(([key, value]) => [
            key,
            { ...value },
          ]),
        ),
      }
    case 'resizing-node':
      return {
        mode: 'resizing-node',
        pointerId: interaction.pointerId,
        nodeId: interaction.nodeId,
        handle: interaction.handle,
        startScreenPoint: { ...interaction.startScreenPoint },
        startNodeBounds: { ...interaction.startNodeBounds },
        aspectRatio: interaction.aspectRatio,
      }
    case 'box-select':
      return {
        mode: 'box-select',
        pointerId: interaction.pointerId,
        selectionMode: interaction.selectionMode,
        startScreenPoint: { ...interaction.startScreenPoint },
        currentScreenPoint: { ...interaction.currentScreenPoint },
        startWorldPoint: { ...interaction.startWorldPoint },
        currentWorldPoint: { ...interaction.currentWorldPoint },
      }
  }
}

export function validateState(
  state: BoardState,
  grid: GridSettings,
  context: string,
): ValidationFailure[] {
  const failures: ValidationFailure[] = []
  const push = (name: string, message: string) => {
    failures.push({ name, message, context, state })
  }

  if (
    !Number.isFinite(state.camera.x) ||
    !Number.isFinite(state.camera.y) ||
    !Number.isFinite(state.camera.z) ||
    state.camera.z <= 0
  ) {
    push(
      'camera.valid',
      'Camera position must be finite and zoom must be greater than 0.',
    )
  }

  if (grid.size <= 0 || !Number.isFinite(grid.size)) {
    push('grid.size', 'Grid size must be a finite number greater than 0.')
  }
  if (
    grid.majorEvery < 1 ||
    !Number.isFinite(grid.majorEvery) ||
    !Number.isInteger(grid.majorEvery)
  ) {
    push(
      'grid.majorEvery',
      'Grid majorEvery must be an integer greater than or equal to 1.',
    )
  }
  if (grid.edgeSnapThreshold <= 0 || !Number.isFinite(grid.edgeSnapThreshold)) {
    push(
      'grid.edgeSnapThreshold',
      'Grid edgeSnapThreshold must be a finite number greater than 0.',
    )
  }

  const zIndexes = new Set<number>()
  for (const node of state.nodes.values()) {
    validateNode(node, push)
    validateNodeParent(node, state, push)
    if (zIndexes.has(node.zIndex)) {
      push(
        'node.zIndex.unique',
        `Node ${node.id} shares a z-index with another node.`,
      )
    }
    zIndexes.add(node.zIndex)
  }

  for (const id of state.selection.values()) {
    if (!state.nodes.has(id)) {
      push('selection.exists', `Selected node ${id} does not exist.`)
    }
  }

  if (
    state.interaction.mode === 'editing-text' &&
    !state.nodes.has(state.interaction.nodeId)
  ) {
    push(
      'interaction.node',
      `Editing node ${state.interaction.nodeId} does not exist.`,
    )
  }
  if (
    state.interaction.mode === 'resizing-node' &&
    !state.nodes.has(state.interaction.nodeId)
  ) {
    push(
      'interaction.node',
      `Resizing node ${state.interaction.nodeId} does not exist.`,
    )
  }
  if (state.interaction.mode === 'dragging-nodes') {
    for (const id of state.interaction.nodeIds) {
      if (!state.nodes.has(id)) {
        push('interaction.node', `Dragging node ${id} does not exist.`)
      }
    }
  }

  return failures
}

function validateNode(
  node: BoardNode,
  push: (name: string, message: string) => void,
): void {
  if (
    !Number.isFinite(node.x) ||
    !Number.isFinite(node.y) ||
    !Number.isFinite(node.width) ||
    !Number.isFinite(node.height)
  ) {
    push('node.finite', `Node ${node.id} contains non-finite geometry.`)
  }
  if (node.width <= 0 || node.height <= 0) {
    push('node.size', `Node ${node.id} must have positive width and height.`)
  }
}

function validateNodeParent(
  node: BoardNode,
  state: BoardState,
  push: (name: string, message: string) => void,
): void {
  if (node.parentId === undefined) {
    return
  }
  if (node.parentId === node.id) {
    push('node.parentId', `Node ${node.id} cannot be its own parent.`)
    return
  }
  const parent = state.nodes.get(node.parentId)
  if (!parent) {
    push(
      'node.parentId',
      `Node ${node.id} references missing parent ${node.parentId}.`,
    )
    return
  }
  if (parent.type !== 'group') {
    push(
      'node.parentId',
      `Node ${node.id} parent must be type "group", got "${parent.type}".`,
    )
  }
  let walk: BoardNode | undefined = parent
  const seen = new Set<NodeId>()
  while (walk) {
    if (seen.has(walk.id)) {
      push(
        'node.parentId',
        `Cycle detected in parent chain for node ${node.id}.`,
      )
      return
    }
    seen.add(walk.id)
    if (walk.id === node.id) {
      push(
        'node.parentId',
        `Node ${node.id} would create a cycle in the parent chain.`,
      )
      return
    }
    if (!walk.parentId) {
      break
    }
    walk = state.nodes.get(walk.parentId)
  }
}
