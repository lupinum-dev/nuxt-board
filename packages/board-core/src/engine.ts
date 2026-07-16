import {
  boundsContain,
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
  pointInBounds,
  screenToWorld,
  snapValue,
  worldToScreen,
  zoomCameraAtScreenPoint,
} from './math.js'
import {
  collectSubtreeIds,
  collectUniformTranslationTargets,
  findContainingGroup,
  getBoundsFromNode,
  sortIdsByZIndex,
} from './hierarchy.js'
import {
  applyResizeDelta,
  applyResizeDeltaLocked,
  snapResizedBounds,
  snapResizedBoundsLocked,
} from './resize.js'
import {
  buildSnapEdgeIndex,
  snapBoundsToEdges,
  snapPositionToEdges,
  type SnapEdgeIndex,
} from './snap.js'
import { freezeClone } from './helpers/clone.js'
import { createNodeId } from './helpers/ids.js'
import { AnimationCancelled } from './helpers/animation.js'
import type {
  InternalBoardCommit,
  InternalHistoryRoot,
  MutableBoardState,
} from './state/types.js'
import {
  DEFAULT_CAMERA,
  DEFAULT_GRID,
  DEFAULT_NODE_CONSTRAINTS,
  DEFAULT_VIEWPORT_SIZE,
  DEFAULT_ZOOM,
} from './state/types.js'
import { normalizeExistingNode } from './state/initial.js'
import { materializeNode as materializeNodePure } from './helpers/node-shape.js'
import {
  buildPublicNodeMap,
  buildPublicState,
  buildSnapshot,
} from './state/selectors.js'
import {
  duplicateForest as duplicateForestPure,
  getCopyClosureNodes as getCopyClosureNodesPure,
  getSelectionNodes as getSelectionNodesPure,
} from './helpers/selection-helpers.js'
import { createEventBus } from './engine/events.js'
import {
  createBatchCommandController,
  createCommandGuardRegistry,
  createValidator,
} from './engine/command-runtime.js'
import { createReactiveLayer } from './engine/subscribables.js'
import {
  createTransactionExecutor,
  stagePersistentRoots,
  type MutablePluginStates,
  type PersistentRoots,
  type RuntimeCommandMetadata,
} from './engine/transaction.js'
import {
  documentToSnapshot,
  materializeSnapshotNodes,
  normalizeDocumentForImport,
  toPersistedDocument,
} from './engine/persistence.js'
import { assertInternalBoardPlugin } from './internal.js'
import { registerBoardInteractionAdapter } from './engine/interaction-adapter.js'
import { createCameraSession } from './engine/camera-session.js'
import {
  applyNodePatchToNode,
  normalizeNodeInput,
} from './engine/node-shape.js'
import {
  BoardConflictError,
  BoardDestroyedError,
  BoardError,
  BoardInputError,
  BoardNotFoundError,
} from './errors.js'
import {
  validateBoardConfiguration,
  validateGridSettings,
} from './engine/options.js'
import type {
  BoxSelectBehavior,
  BoxSelectMode,
  InternalBoardSnapshot,
  BoardState,
  Camera,
  BoardEngine,
  BoardEngineOptions,
  BoardNode,
  GridSettings,
  InternalBoardPlugin,
  InternalPluginContext,
  InternalInteractionAdapter,
  InstalledPluginApis,
  InstalledPluginEvents,
  BoardPluginApis,
  BoardPlugin,
  CommandMetadata,
  InteractionState,
  JsonCanvasDocument,
  NodeConstraints,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  SnapGuide,
  Subscribable,
  ZoomSettings,
} from './types.js'

export class CommandBlockedError extends BoardError {
  constructor(
    readonly command: string,
    readonly args: readonly unknown[],
    readonly reason: string,
  ) {
    super(`Command "${command}" was blocked: ${reason}`)
    this.name = 'CommandBlockedError'
  }
}

const CONNECTIONS_FEATURE_NAME = 'connections'
const RECORD_COMMAND: CommandMetadata = { history: 'record' }
const IGNORE_COMMAND: CommandMetadata = { history: 'ignore' }
const IGNORE_UNVALIDATED_COMMAND: RuntimeCommandMetadata = {
  history: 'ignore',
  validate: false,
}

function requireFiniteInput(name: string, ...values: number[]): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new BoardInputError(`${name} must contain only finite numbers.`)
  }
}

function requireNonNegativeInput(name: string, value: number): void {
  requireFiniteInput(name, value)
  if (value < 0) {
    throw new BoardInputError(`${name} must be greater than or equal to 0.`)
  }
}

/**
 * Create a headless board engine with commands, reactive state, and internal plugin hooks.
 *
 * @example
 * const engine = createBoardEngine({
 *   initialNodes: [{ id: asNodeId('a'), type: 'text', x: 0, y: 0, width: 160, height: 80, text: 'Hello', zIndex: 1, locked: false, visible: true }],
 * })
 */
export function createBoardEngine<
  const TPlugins extends readonly BoardPlugin[] = readonly [],
>(
  options: BoardEngineOptions<TPlugins> = {} as BoardEngineOptions<TPlugins>,
): BoardEngine<InstalledPluginApis<TPlugins>, InstalledPluginEvents<TPlugins>> {
  const camera: Camera = { ...DEFAULT_CAMERA, ...options.camera }
  const zoom: ZoomSettings = { ...DEFAULT_ZOOM, ...options.zoom }
  let grid: GridSettings = { ...DEFAULT_GRID, ...options.grid }
  const boxSelectBehavior: BoxSelectBehavior =
    options.boxSelect?.behavior ?? 'autocad'
  const nodeConstraints: NodeConstraints = {
    ...DEFAULT_NODE_CONSTRAINTS,
    ...options.nodes,
  }
  const diagnosticsEnabled = Boolean(options.diagnostics)
  const traceLimit =
    typeof options.diagnostics === 'object' &&
    options.diagnostics.traceLimit !== undefined
      ? options.diagnostics.traceLimit
      : 500

  validateBoardConfiguration({
    camera,
    zoom,
    grid,
    nodeConstraints,
    plugins: options.plugins ?? [],
    diagnostics: options.diagnostics,
    boxSelectBehavior,
  })
  for (const plugin of options.plugins ?? []) {
    assertInternalBoardPlugin(plugin)
  }

  const eventBus = createEventBus({
    diagnosticsEnabled,
    traceLimit,
    onUnhandledError: options.onUnhandledError,
  })
  const { emit, emitImmediate, on, once, off, reportUnhandledError } = eventBus
  const commandGuards = createCommandGuardRegistry()
  const commitProjectors = new Set<
    (commit: InternalBoardCommit) => () => void
  >()
  const nodeDeletedHooks = new Set<(nodeId: NodeId) => void>()
  const pluginCleanups = new Map<string, () => void>()
  let pluginStates: MutablePluginStates = new Map()
  const pluginPersistence = new Map<
    string,
    {
      context: InternalPluginContext
      hooks: NonNullable<InternalBoardPlugin['persistence']>
    }
  >()
  function notifyNodeDeletedPlugins(nodeId: NodeId): void {
    for (const hook of nodeDeletedHooks) hook(nodeId)
  }
  const clipboard: BoardNode[] = []
  const plugins = {} as BoardPluginApis
  let viewportSize = { ...DEFAULT_VIEWPORT_SIZE }
  let destroyed = false
  let finalizingCommitEffects = false
  let activeGestureHistoryRoot: InternalHistoryRoot | null = null
  let activeBoxSelectionBefore: ReadonlySet<NodeId> | null = null
  const nodeOverrides = new Map<NodeId, BoardNode>()
  let indexedNodeRoot: ReadonlyMap<NodeId, BoardNode> | null = null
  let snapEdgeIndex: SnapEdgeIndex | null = null

  function getSnapEdgeIndex(): SnapEdgeIndex {
    if (indexedNodeRoot !== state.nodes || !snapEdgeIndex) {
      indexedNodeRoot = state.nodes
      snapEdgeIndex = buildSnapEdgeIndex(state.nodes.values())
    }
    return snapEdgeIndex
  }

  function assertAlive(): void {
    if (destroyed) {
      throw new BoardDestroyedError()
    }
  }

  function assertMutationAllowed(): void {
    if (finalizingCommitEffects) {
      throw new BoardConflictError(
        'Board mutations are unavailable during commit-effect finalization.',
      )
    }
  }

  function assertCommandReady(): void {
    assertAlive()
    assertMutationAllowed()
  }

  let state: MutableBoardState = {
    camera,
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 1,
  }
  const initialDocument = options.initialDocument
    ? normalizeDocumentForImport(options.initialDocument)
    : null

  if (initialDocument) {
    const initial = documentToSnapshot(initialDocument)
    state.camera = { ...initial.camera }
    state.selection = new Set()
    state.nextZIndex = initial.nextZIndex
    Object.assign(grid, { ...initial.grid })
    for (const rawNode of materializeSnapshotNodes(initial)) {
      const normalized = normalizeExistingNode(rawNode)
      state.nodes.set(normalized.id, normalized)
      state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
    }
    state.selection = new Set(
      initial.selection.filter((id) => state.nodes.has(id)),
    )
  }

  for (const node of options.initialNodes ?? []) {
    const normalized = normalizeExistingNode(node)
    if (state.nodes.has(normalized.id)) {
      throw new BoardConflictError(
        `Cannot initialize board: node "${normalized.id}" is duplicated.`,
      )
    }
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }

  const reactive = createReactiveLayer({
    getState: () => state,
    getGrid: () => grid,
    emit,
    reportSubscriberError: (channel, error) =>
      reportUnhandledError(error, { source: 'subscriber', channel }),
    getEffectiveNodes: () => {
      if (nodeOverrides.size === 0) return state.nodes
      const effective = new Map<NodeId, BoardNode>(state.nodes)
      for (const [id, node] of nodeOverrides) effective.set(id, node)
      return effective
    },
  })
  const {
    batchCtrl,
    $camera,
    $grid,
    $nodes,
    $selection,
    $interaction,
    $snapGuides,
    getPublicNodeMap,
    invalidateNodeCache,
    notifyNodesChanged,
    notifyCameraChanged,
    notifyGridChanged,
    notifySelectionChanged,
    notifyInteractionChanged,
    notifySnapGuidesChanged,
    setCamera,
    setSelection,
    setInteraction,
    setSnapGuides,
    destroy: destroyReactiveLayer,
  } = reactive

  const cameraSession = createCameraSession({
    getCamera: () => state.camera,
    getNodes: () => state.nodes.values(),
    getViewportSize: () => viewportSize,
    setCamera,
    zoom,
  })

  const batches = createBatchCommandController({
    batchCtrl,
    emitCommandBefore: (name, args, metadata) =>
      emit('command:before', name, args, metadata),
    emitCommandAfter: (name, args, duration, metadata) =>
      emit('command:after', name, args, duration, metadata),
    validate: (ctx) => validate(ctx),
  })

  function getGridSettings(): GridSettings {
    assertAlive()
    return freezeClone({ ...grid })
  }

  function resolveBoxSelectMode(
    startScreenPoint: Point,
    currentScreenPoint: Point,
  ): BoxSelectMode {
    if (boxSelectBehavior === 'contain') {
      return 'window'
    }
    if (boxSelectBehavior === 'intersect') {
      return 'crossing'
    }
    return currentScreenPoint.x >= startScreenPoint.x ? 'window' : 'crossing'
  }

  function getViewportSize(): Point {
    assertAlive()
    return freezeClone({ ...viewportSize })
  }

  function materializeNode(node: BoardNode): BoardNode {
    return materializeNodePure(node)
  }

  function getState(): BoardState {
    assertAlive()
    return buildPublicState(state, grid, getPublicNodeMap())
  }

  interface EngineCheckpoint {
    roots: PersistentRoots
    clipboard: BoardNode[]
    nodeOverrides: Map<NodeId, BoardNode>
    activeGestureHistoryRoot: InternalHistoryRoot | null
    activeBoxSelectionBefore: ReadonlySet<NodeId> | null
  }

  function beginPersistentTransaction(): EngineCheckpoint {
    const roots = { state, grid, pluginStates }
    const checkpoint: EngineCheckpoint = {
      roots,
      clipboard: [...clipboard],
      nodeOverrides: new Map(nodeOverrides),
      activeGestureHistoryRoot,
      activeBoxSelectionBefore,
    }
    const candidate = stagePersistentRoots(roots)
    state = candidate.state
    grid = candidate.grid
    pluginStates = candidate.pluginStates
    return checkpoint
  }

  function rollbackPersistentTransaction(checkpoint: EngineCheckpoint): void {
    state = checkpoint.roots.state
    grid = checkpoint.roots.grid
    pluginStates = checkpoint.roots.pluginStates
    clipboard.splice(0, clipboard.length, ...checkpoint.clipboard)
    nodeOverrides.clear()
    for (const [id, node] of checkpoint.nodeOverrides) {
      nodeOverrides.set(id, node)
    }
    activeGestureHistoryRoot = checkpoint.activeGestureHistoryRoot
    activeBoxSelectionBefore = checkpoint.activeBoxSelectionBefore
    invalidateNodeCache()
  }

  function captureHistoryRoot(): InternalHistoryRoot {
    return {
      nodes: state.nodes,
      grid: freezeClone({ ...grid }),
      selection: state.selection,
      nextZIndex: state.nextZIndex,
      pluginSlices: new Map(
        Array.from(pluginStates, ([name, pluginState]) => [
          name,
          pluginState.state,
        ]),
      ),
    }
  }

  function sameHistoryRoot(
    left: InternalHistoryRoot,
    right: InternalHistoryRoot,
  ): boolean {
    if (left.nextZIndex !== right.nextZIndex) return false
    if (
      left.grid.size !== right.grid.size ||
      left.grid.majorEvery !== right.grid.majorEvery ||
      left.grid.snap !== right.grid.snap ||
      left.grid.edgeSnap !== right.grid.edgeSnap ||
      left.grid.edgeSnapThreshold !== right.grid.edgeSnapThreshold ||
      left.grid.pattern !== right.grid.pattern
    ) {
      return false
    }
    if (left.nodes.size !== right.nodes.size) return false
    for (const [id, node] of left.nodes) {
      if (right.nodes.get(id) !== node) return false
    }
    if (left.selection.size !== right.selection.size) return false
    for (const id of left.selection) {
      if (!right.selection.has(id)) return false
    }
    if (left.pluginSlices.size !== right.pluginSlices.size) return false
    for (const [name, slice] of left.pluginSlices) {
      if (right.pluginSlices.get(name) !== slice) return false
    }
    return true
  }

  function prepareCommit(
    label: string,
    metadata: CommandMetadata,
    before: InternalHistoryRoot,
  ): { label: string; finalize: () => readonly unknown[] } | null {
    const after = captureHistoryRoot()
    if (sameHistoryRoot(before, after)) return null
    const commit: InternalBoardCommit = Object.freeze({
      label,
      timestamp: Date.now(),
      metadata,
      before,
      after,
    })
    const effects = Array.from(commitProjectors, (project) => project(commit))
    return {
      label,
      finalize() {
        const errors: unknown[] = []
        finalizingCommitEffects = true
        try {
          for (const effect of effects) {
            try {
              effect()
            } catch (error) {
              errors.push(error)
            }
          }
        } finally {
          finalizingCommitEffects = false
        }
        return errors
      },
    }
  }

  const validate = createValidator({
    getState: () => getState(),
    getGrid: () => grid,
    emitFailure: (failure) => emitImmediate('validation:failed', failure),
  })

  function discardActiveInteraction(): void {
    if (state.interaction.mode === 'idle' && nodeOverrides.size === 0) return
    const hadNodeOverrides = nodeOverrides.size > 0
    const selectionBefore =
      state.interaction.mode === 'box-select' ? activeBoxSelectionBefore : null
    nodeOverrides.clear()
    activeGestureHistoryRoot = null
    activeBoxSelectionBefore = null
    setSnapGuides([])
    if (selectionBefore) setSelection(selectionBefore)
    setInteraction({ mode: 'idle' })
    if (hadNodeOverrides) notifyNodesChanged()
  }

  const { runCommand, runAsyncCommand } = createTransactionExecutor({
    assertAlive: assertCommandReady,
    runGuard: (name, args, metadata) => commandGuards.run(name, args, metadata),
    emitBlocked: (name, args, metadata) =>
      emitImmediate('command:blocked', name, args, metadata),
    emitBefore: (name, args, metadata) =>
      emit('command:before', name, args, metadata),
    emitAfter: (name, args, duration, metadata) =>
      emit('command:after', name, args, duration, metadata),
    createBlockedError: (name, args, reason) =>
      new CommandBlockedError(name, args, reason),
    isBatching: () => batches.isBatching(),
    canOwnEffects: () => batchCtrl.depth === 0,
    beginEffects: () => {
      batchCtrl.depth += 1
      eventBus.beginTransaction()
    },
    commitEffects: () => {
      batchCtrl.depth -= 1
      batches.flushBatchNotifications()
      eventBus.commitTransaction()
    },
    rollbackEffects: () => {
      batchCtrl.depth -= 1
      batches.rollbackBatchNotifications()
      eventBus.rollbackTransaction()
    },
    markValidationPending: () => batches.markValidationPending(),
    captureHistoryRoot,
    beginPersistentTransaction,
    rollbackPersistentTransaction,
    beforeExecute: (name, metadata, historyBefore) => {
      const restoresBoxSelection =
        state.interaction.mode === 'box-select' &&
        activeBoxSelectionBefore !== null
      if (metadata.history === 'record' && name !== 'endInteraction') {
        discardActiveInteraction()
        if (restoresBoxSelection && historyBefore) {
          return {
            ...historyBefore,
            selection: new Set(state.selection),
          }
        }
      }
      return null
    },
    prepareCommit,
    reportCommitError: (label, error) =>
      reportUnhandledError(error, {
        source: 'commit-effect',
        commit: label,
      }),
    validate,
    isCancellation: (error) => error instanceof AnimationCancelled,
  })

  function assertBoardNode(id: NodeId): BoardNode {
    const node = nodeOverrides.get(id) ?? state.nodes.get(id)
    if (!node) {
      throw new BoardNotFoundError(`Node "${id}" does not exist.`)
    }
    return node
  }

  function setNodeOverride(node: BoardNode): BoardNode {
    nodeOverrides.set(node.id, node)
    return node
  }

  function commitNodeOverrides(
    interaction: Extract<
      InteractionState,
      { mode: 'dragging-nodes' | 'resizing-node' }
    >,
  ): void {
    for (const [id, next] of nodeOverrides) {
      const before = state.nodes.get(id)
      if (!before || before === next) continue
      state.nodes.set(id, next)
      if (interaction.mode === 'dragging-nodes') {
        emit('node:moved', materializeNode(next), {
          x: next.x - before.x,
          y: next.y - before.y,
        })
        emit('node:updated', materializeNode(next), materializeNode(before))
      } else if (id === interaction.nodeId) {
        emitNodeResize(before, next)
      }
    }
    nodeOverrides.clear()
    notifyNodesChanged()
  }

  function normalizeNode(input: NodeInput): BoardNode {
    const normalized = normalizeNodeInput(input, {
      nodes: state.nodes,
      grid,
      constraints: nodeConstraints,
      nextZIndex: state.nextZIndex,
    })
    state.nextZIndex = normalized.nextZIndex
    return normalized.node
  }

  function applyNodePatch(node: BoardNode, patch: NodePatch): BoardNode {
    return applyNodePatchToNode(node, patch, {
      nodes: state.nodes,
      grid,
      constraints: nodeConstraints,
    })
  }

  function replaceBoardNodeWithoutNotify(
    node: BoardNode,
    next: BoardNode,
  ): BoardNode {
    const stored = next
    state.nodes.set(node.id, stored)
    invalidateNodeCache()
    return stored
  }

  function replaceBoardNode(node: BoardNode, next: BoardNode): BoardNode {
    const stored = replaceBoardNodeWithoutNotify(node, next)
    notifyNodesChanged()
    return stored
  }

  function emitNodeResize(before: BoardNode, after: BoardNode): void {
    const publicNode = materializeNode(after)
    emit('node:resized', publicNode, {
      x: before.x,
      y: before.y,
      width: before.width,
      height: before.height,
    })
    emit('node:updated', publicNode, materializeNode(before))
  }

  function getPublicNode(id: NodeId): BoardNode {
    return materializeNode(assertBoardNode(id))
  }

  function getDirectChildren(parentId: NodeId): BoardNode[] {
    return Array.from(state.nodes.values()).filter(
      (node) => node.parentId === parentId,
    )
  }

  function collectSubtreeIdSet(rootId: NodeId, into: Set<NodeId>): void {
    collectSubtreeIds(rootId, state.nodes as Map<NodeId, BoardNode>, into)
  }

  function forestIdsFromSeeds(seedIds: Iterable<NodeId>): Set<NodeId> {
    const out = new Set<NodeId>()
    for (const id of seedIds) {
      if (state.nodes.has(id)) {
        collectSubtreeIdSet(id, out)
      }
    }
    return out
  }

  function deletionOrderPostOrder(ids: Set<NodeId>): NodeId[] {
    const memo = new Map<NodeId, number>()
    function depthOf(id: NodeId): number {
      const cached = memo.get(id)
      if (cached !== undefined) {
        return cached
      }
      const node = state.nodes.get(id)
      if (!node?.parentId || !ids.has(node.parentId)) {
        memo.set(id, 0)
        return 0
      }
      const depth = depthOf(node.parentId) + 1
      memo.set(id, depth)
      return depth
    }
    return Array.from(ids).sort((a, b) => depthOf(b) - depthOf(a))
  }

  function fixSubtreeZOrderAfter(
    parent: BoardNode | null,
    nodeId: NodeId,
  ): void {
    const node = state.nodes.get(nodeId)
    if (!node) {
      return
    }
    let current = node
    if (parent && current.zIndex <= parent.zIndex) {
      current = replaceBoardNode(node, {
        ...node,
        zIndex: state.nextZIndex++,
      })
    }
    for (const child of getDirectChildren(nodeId)) {
      fixSubtreeZOrderAfter(current, child.id)
    }
  }

  function restackGroupDescendantsAbove(groupId: NodeId): void {
    const group = state.nodes.get(groupId)
    if (!group || group.type !== 'group') {
      return
    }
    for (const child of getDirectChildren(groupId)) {
      fixSubtreeZOrderAfter(group, child.id)
    }
  }

  function reparentAfterDrag(movedIds: NodeId[]): void {
    const ordered = sortIdsByZIndex(
      movedIds,
      state.nodes as Map<NodeId, BoardNode>,
    )
    for (const id of ordered) {
      const node = state.nodes.get(id)
      if (!node) {
        continue
      }
      const nextParent = findContainingGroup(
        node,
        state.nodes as Map<NodeId, BoardNode>,
      )
      if (nextParent === node.parentId) {
        continue
      }
      const updated = replaceBoardNode(node, {
        ...node,
        parentId: nextParent,
      })
      emit('node:updated', materializeNode(updated), materializeNode(node))
      fixSubtreeZOrderAfter(nextParent ? assertBoardNode(nextParent) : null, id)
    }
  }

  function reparentNodesCapturedByGroups(
    groupIds: NodeId[],
    excludeIds: Iterable<NodeId>,
  ): void {
    const exclude = new Set(excludeIds)
    const groups = groupIds
      .map((id) => state.nodes.get(id))
      .filter((node): node is BoardNode => Boolean(node))
      .filter((node) => node.type === 'group' && node.visible)

    if (groups.length === 0) {
      return
    }

    const captured: NodeId[] = []
    for (const node of state.nodes.values()) {
      if (exclude.has(node.id) || node.locked || !node.visible) {
        continue
      }
      if (
        groups.some((group) =>
          boundsContain(getBoundsFromNode(group), getBoundsFromNode(node)),
        )
      ) {
        captured.push(node.id)
      }
    }

    if (captured.length > 0) {
      reparentAfterDrag(captured)
    }
  }

  function reparentNodesCapturedByMovedGroups(movedIds: NodeId[]): void {
    reparentNodesCapturedByGroups(movedIds, movedIds)
  }

  function getSelectionNodes(): BoardNode[] {
    return getSelectionNodesPure(state)
  }

  function getCopyClosureNodes(): BoardNode[] {
    return getCopyClosureNodesPure(state)
  }

  function duplicateForest(
    nodes: BoardNode[],
    offset: Point,
  ): { nodes: BoardNode[]; idMap: ReadonlyMap<NodeId, NodeId> } {
    return duplicateForestPure(state, grid, nodes, offset)
  }

  function cleanupSelection(): void {
    setSelection(
      Array.from(state.selection.values()).filter((id) => state.nodes.has(id)),
    )
  }

  function restoreSnapshot(
    snapshot: InternalBoardSnapshot,
    mode: 'replace' | 'merge',
  ): Map<NodeId, NodeId> {
    const snapshotNodes = materializeSnapshotNodes(snapshot)
    const idMap = new Map<NodeId, NodeId>()
    if (mode === 'replace') {
      const existingIds = deletionOrderPostOrder(new Set(state.nodes.keys()))
      for (const id of existingIds) {
        const prevNode = state.nodes.get(id)
        if (!prevNode) {
          continue
        }
        state.nodes.delete(id)
        notifyNodeDeletedPlugins(prevNode.id)
        emit('node:deleted', id, materializeNode(prevNode))
      }

      state.nextZIndex =
        snapshot.nextZIndex ??
        snapshotNodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
      for (const rawNode of snapshotNodes) {
        const node = normalizeExistingNode(rawNode)
        state.nodes.set(node.id, node)
        idMap.set(rawNode.id, node.id)
        emit('node:created', materializeNode(node))
      }

      state.selection = new Set(
        snapshot.selection.filter((id) => state.nodes.has(id)),
      )
      state.interaction = { mode: 'idle' }
      state.snapGuides = []
      state.camera = { ...snapshot.camera }
      Object.assign(grid, { ...snapshot.grid })
      notifyCameraChanged()
      notifyNodesChanged()
      notifySelectionChanged()
      notifyInteractionChanged()
      notifySnapGuidesChanged()
      return idMap
    }

    for (const rawNode of snapshotNodes) {
      const node = normalizeExistingNode(rawNode)
      const id = state.nodes.has(node.id) ? createNodeId() : node.id
      state.nodes.set(id, { ...node, id, zIndex: state.nextZIndex++ })
      idMap.set(node.id, id)
    }
    notifyNodesChanged()
    return idMap
  }

  function restorePluginDocuments(
    document: JsonCanvasDocument,
    mode: 'replace' | 'merge',
    idMap: ReadonlyMap<NodeId, NodeId> = new Map(),
  ): void {
    for (const entry of pluginPersistence.values()) {
      entry.hooks.loadDocument?.(entry.context, document, mode, idMap)
    }
  }

  function assertCanRestoreDocument(document: JsonCanvasDocument): void {
    if (
      document.edges?.length &&
      !pluginPersistence.has(CONNECTIONS_FEATURE_NAME)
    ) {
      throw new BoardInputError(
        'Invalid board document: edges require the connections plugin.',
      )
    }
  }

  function installPlugin(plugin: InternalBoardPlugin): void {
    if (plugin.slice) {
      pluginStates.set(plugin.name, {
        state: plugin.slice.initial,
      })
    }
    const pluginCtx: InternalPluginContext = Object.assign(
      Object.create(engine) as InternalPluginContext,
      {
        getPluginState: <S>(): S => {
          assertAlive()
          const entry = pluginStates.get(plugin.name)
          if (!entry) {
            throw new Error(
              `Plugin "${plugin.name}" did not register a persistent slice.`,
            )
          }
          return entry.state as S
        },
        updatePluginState: <S>(update: (current: S) => S): S => {
          assertAlive()
          assertMutationAllowed()
          const entry = pluginStates.get(plugin.name)
          if (!entry) {
            throw new Error(
              `Plugin "${plugin.name}" did not register a persistent slice.`,
            )
          }
          const next = update(entry.state as S)
          entry.state = next
          return next
        },
      },
    )
    const cleanup = plugin.install(pluginCtx)
    if (plugin.nodeDeleted) {
      nodeDeletedHooks.add((nodeId) => plugin.nodeDeleted!(pluginCtx, nodeId))
    }
    if (plugin.persistence) {
      pluginPersistence.set(plugin.name, {
        context: pluginCtx,
        hooks: plugin.persistence,
      })
    }
    pluginCleanups.set(plugin.name, cleanup ?? (() => undefined))
  }

  const engine: InternalPluginContext & InternalInteractionAdapter = {
    plugins,
    assertActive: assertAlive,
    isBatching: () => batches.isBatching(),
    $camera,
    $grid,
    $nodes: $nodes as Subscribable<ReadonlyMap<NodeId, BoardNode>>,
    $selection: $selection as Subscribable<ReadonlySet<NodeId>>,
    $interaction,
    $snapGuides,
    destroy() {
      if (destroyed) {
        return
      }
      assertMutationAllowed()
      destroyed = true
      cameraSession.cancelAnimations()
      nodeOverrides.clear()
      activeGestureHistoryRoot = null
      activeBoxSelectionBefore = null
      const cleanupErrors: unknown[] = []
      for (const cleanup of pluginCleanups.values()) {
        try {
          cleanup()
        } catch (error) {
          cleanupErrors.push(error)
        }
      }
      emit('destroy')
      pluginCleanups.clear()
      pluginStates.clear()
      pluginPersistence.clear()
      commitProjectors.clear()
      nodeDeletedHooks.clear()
      commandGuards.clear()
      eventBus.clear()
      destroyReactiveLayer()
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          'One or more board plugin cleanups failed.',
        )
      }
    },
    extend(key, value) {
      assertMutationAllowed()
      ;(plugins as unknown as Record<string, unknown>)[key] = value as unknown
    },
    batch(fn) {
      assertCommandReady()
      if (batches.isBatching()) {
        batches.batch(fn)
        return
      }
      const originalHistoryBefore = captureHistoryRoot()
      const checkpoint = beginPersistentTransaction()
      eventBus.beginTransaction()
      let historyBefore = originalHistoryBefore
      let commitErrors: readonly unknown[] = []
      try {
        batches.batch(
          () => {
            const restoresBoxSelection =
              state.interaction.mode === 'box-select' &&
              activeBoxSelectionBefore !== null
            discardActiveInteraction()
            if (restoresBoxSelection) {
              historyBefore = {
                ...originalHistoryBefore,
                selection: new Set(state.selection),
              }
            }
            fn()
          },
          () => {
            commitErrors =
              prepareCommit(
                'batch',
                RECORD_COMMAND,
                historyBefore,
              )?.finalize() ?? []
          },
        )
        eventBus.commitTransaction()
        for (const error of commitErrors) {
          reportUnhandledError(error, {
            source: 'commit-effect',
            commit: 'batch',
          })
        }
      } catch (error) {
        rollbackPersistentTransaction(checkpoint)
        eventBus.rollbackTransaction()
        throw error
      }
    },
    getState,
    getGridSettings,
    getViewportSize,
    updateGridSettings(patch) {
      return runCommand('updateGridSettings', [patch], () => {
        const next = { ...grid, ...patch }
        validateGridSettings(next)
        Object.assign(grid, next)
        notifyGridChanged()
        return getGridSettings()
      })
    },
    setViewportSize(size) {
      assertAlive()
      assertMutationAllowed()
      if (!Number.isFinite(size.x) || !Number.isFinite(size.y)) {
        throw new BoardInputError(
          'Viewport width and height must be finite numbers.',
        )
      }
      const next = {
        x: Math.max(1, size.x),
        y: Math.max(1, size.y),
      }
      if (next.x === viewportSize.x && next.y === viewportSize.y) {
        return
      }
      const prev = { ...viewportSize }
      viewportSize = next
      emit('viewport:change', freezeClone({ ...next }), freezeClone(prev))
    },
    emit,
    on(event, handler) {
      assertAlive()
      return on(event, handler)
    },
    once(event, handler) {
      assertAlive()
      return once(event, handler)
    },
    off(event, handler) {
      assertAlive()
      off(event, handler)
    },
    exportTrace() {
      assertAlive()
      return eventBus.exportTrace()
    },
    addCommandGuard(fn) {
      assertAlive()
      assertMutationAllowed()
      return commandGuards.add(fn)
    },
    runCommand<T>(
      name: string,
      args: unknown[],
      fn: () => T,
      metadata: CommandMetadata,
    ): T {
      return runCommand(name, args, fn, metadata)
    },
    projectCommit(projector) {
      assertAlive()
      assertMutationAllowed()
      commitProjectors.add(projector)
      return () => commitProjectors.delete(projector)
    },
    restoreHistoryRoot(root) {
      runCommand(
        'history:restore',
        [],
        () => {
          nodeOverrides.clear()
          activeBoxSelectionBefore = null
          state.nodes = new Map(root.nodes)
          state.selection = new Set(
            Array.from(root.selection).filter((id) => state.nodes.has(id)),
          )
          state.nextZIndex = root.nextZIndex
          Object.assign(grid, root.grid)
          for (const [name, pluginState] of pluginStates) {
            if (root.pluginSlices.has(name)) {
              pluginState.state = root.pluginSlices.get(name)
            }
          }
          setInteraction({ mode: 'idle' })
          setSnapGuides([])
          notifyGridChanged()
          notifyNodesChanged()
          notifySelectionChanged()
        },
        IGNORE_COMMAND,
      )
    },
    getPluginState<S>(): S {
      throw new Error(
        'getPluginState is only available inside an internal plugin install() context.',
      )
    },
    updatePluginState<S>(_update: (current: S) => S): S {
      throw new Error(
        'updatePluginState is only available inside an internal plugin install() context.',
      )
    },
    screenToWorld(point) {
      assertAlive()
      return screenToWorld(point, state.camera)
    },
    worldToScreen(point) {
      assertAlive()
      return worldToScreen(point, state.camera)
    },
    getVisibleBounds(width, height) {
      assertAlive()
      return getVisibleBounds(width, height, state.camera)
    },
    getNode(id) {
      assertAlive()
      return getPublicNode(id)
    },
    findNode(id) {
      assertAlive()
      return state.nodes.has(id) ? getPublicNode(id) : null
    },
    hasNode(id) {
      assertAlive()
      return state.nodes.has(id)
    },
    getNodeAt(worldPoint) {
      assertAlive()
      let best: BoardNode | null = null
      let bestZ = -Infinity
      for (const node of state.nodes.values()) {
        if (
          node.visible &&
          node.zIndex > bestZ &&
          pointInBounds(worldPoint, getBoundsFromNode(node))
        ) {
          best = node
          bestZ = node.zIndex
        }
      }
      return best ? materializeNode(best) : null
    },
    getNodesInBounds(bounds) {
      assertAlive()
      return Array.from(state.nodes.values())
        .filter(
          (node) =>
            node.visible && boundsIntersect(getBoundsFromNode(node), bounds),
        )
        .map((node) => materializeNode(node))
    },
    panBy(dx, dy) {
      requireFiniteInput('panBy delta', dx, dy)
      runCommand(
        'panBy',
        [dx, dy],
        () => {
          setCamera({
            x: state.camera.x - dx / state.camera.z,
            y: state.camera.y - dy / state.camera.z,
            z: state.camera.z,
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    panTo(worldPoint, animated = false) {
      requireFiniteInput('panTo point', worldPoint.x, worldPoint.y)
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z }
      return runAsyncCommand(
        'panTo',
        [worldPoint, animated],
        async () => {
          if (animated) {
            await cameraSession.animateTo(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomAt(screenPoint, delta) {
      requireFiniteInput('zoomAt input', screenPoint.x, screenPoint.y, delta)
      runCommand(
        'zoomAt',
        [screenPoint, delta],
        () => {
          setCamera(
            zoomCameraAtScreenPoint(
              screenPoint,
              delta,
              state.camera,
              zoom.min,
              zoom.max,
            ),
          )
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomTo(level, animated = false) {
      requireFiniteInput('zoomTo level', level)
      const clamped = clamp(level, zoom.min, zoom.max)
      const viewportCenter = { x: viewportSize.x / 2, y: viewportSize.y / 2 }
      const centerWorld = screenToWorld(viewportCenter, state.camera)
      const target = {
        x: viewportCenter.x / clamped - centerWorld.x,
        y: viewportCenter.y / clamped - centerWorld.y,
        z: clamped,
      }
      return runAsyncCommand(
        'zoomTo',
        [level, animated],
        async () => {
          if (animated) {
            await cameraSession.animateTo(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomToFit(padding = 40, animated = false) {
      requireNonNegativeInput('zoomToFit padding', padding)
      return runAsyncCommand(
        'zoomToFit',
        [padding, animated],
        async () => {
          const target = cameraSession.computeFit(null, padding)
          if (!target) {
            return
          }
          if (animated) {
            await cameraSession.animateTo(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomToNodes(ids, padding = 40, animated = false) {
      requireNonNegativeInput('zoomToNodes padding', padding)
      return runAsyncCommand(
        'zoomToNodes',
        [ids, padding, animated],
        async () => {
          const target = cameraSession.computeFit(ids, padding)
          if (!target) {
            return
          }
          if (animated) {
            await cameraSession.animateTo(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    createNode(input: NodeInput) {
      return runCommand('createNode', [input], () => {
        const node = normalizeNode(input)
        state.nodes.set(node.id, node)
        notifyNodesChanged()
        if (input.select !== false) {
          setSelection([node.id])
        }
        const publicNode = materializeNode(node)
        emit('node:created', publicNode)
        return publicNode
      })
    },
    updateNode(id: NodeId, patch: NodePatch) {
      return runCommand('updateNode', [id, patch], () => {
        const current = assertBoardNode(id)
        const next = applyNodePatch(current, patch)
        const stored = replaceBoardNode(current, next)
        const publicNode = materializeNode(stored)
        emit('node:updated', publicNode, materializeNode(current))
        return publicNode
      })
    },
    deleteNode(id) {
      runCommand('deleteNode', [id], () => {
        assertBoardNode(id)
        const toDelete = new Set<NodeId>()
        collectSubtreeIdSet(id, toDelete)
        for (const deleteId of deletionOrderPostOrder(toDelete)) {
          const prevNode = state.nodes.get(deleteId)
          if (!prevNode) {
            continue
          }
          state.nodes.delete(deleteId)
          notifyNodeDeletedPlugins(prevNode.id)
          emit('node:deleted', deleteId, materializeNode(prevNode))
        }
        notifyNodesChanged()
        cleanupSelection()
        if (state.interaction.mode !== 'idle') {
          setInteraction({ mode: 'idle' })
        }
      })
    },
    moveNode(id, dx, dy) {
      return runCommand('moveNode', [id, dx, dy], () => {
        const node = assertBoardNode(id)
        if (node.locked) {
          return materializeNode(node)
        }
        const targets = collectUniformTranslationTargets(
          [id],
          state.nodes as Map<NodeId, BoardNode>,
        )
        for (const targetId of targets) {
          const current = assertBoardNode(targetId)
          const next = {
            ...current,
            x: grid.snap
              ? snapValue(current.x + dx, grid.size)
              : current.x + dx,
            y: grid.snap
              ? snapValue(current.y + dy, grid.size)
              : current.y + dy,
          }
          const stored = replaceBoardNodeWithoutNotify(current, next)
          const publicNode = materializeNode(stored)
          emit('node:moved', publicNode, {
            x: publicNode.x - current.x,
            y: publicNode.y - current.y,
          })
          emit('node:updated', publicNode, materializeNode(current))
        }
        if (targets.length > 0) {
          notifyNodesChanged()
        }
        reparentAfterDrag(targets)
        reparentNodesCapturedByMovedGroups(targets)
        return getPublicNode(id)
      })
    },
    translateSelectedNodes(dx, dy) {
      runCommand('translateSelectedNodes', [dx, dy], () => {
        const seeds = Array.from(state.selection.values()).filter((id) => {
          const node = state.nodes.get(id)
          return node && !node.locked
        })
        if (seeds.length === 0) {
          return
        }
        const targets = collectUniformTranslationTargets(
          seeds,
          state.nodes as Map<NodeId, BoardNode>,
        )
        for (const targetId of targets) {
          const current = assertBoardNode(targetId)
          const next = {
            ...current,
            x: grid.snap
              ? snapValue(current.x + dx, grid.size)
              : current.x + dx,
            y: grid.snap
              ? snapValue(current.y + dy, grid.size)
              : current.y + dy,
          }
          const stored = replaceBoardNodeWithoutNotify(current, next)
          const publicNode = materializeNode(stored)
          emit('node:moved', publicNode, {
            x: publicNode.x - current.x,
            y: publicNode.y - current.y,
          })
          emit('node:updated', publicNode, materializeNode(current))
        }
        if (targets.length > 0) {
          notifyNodesChanged()
        }
        reparentAfterDrag(targets)
        reparentNodesCapturedByMovedGroups(targets)
      })
    },
    resizeNode(id, handle, dx, dy) {
      return runCommand('resizeNode', [id, handle, dx, dy], () => {
        const node = assertBoardNode(id)
        if (node.locked) {
          return materializeNode(node)
        }
        const raw = applyResizeDelta(node, handle, dx, dy, {
          minWidth: nodeConstraints.minWidth,
          minHeight: nodeConstraints.minHeight,
        })
        const nextBounds = grid.snap
          ? snapResizedBounds(raw, handle, grid.size, {
              minWidth: nodeConstraints.minWidth,
              minHeight: nodeConstraints.minHeight,
            })
          : raw
        const stored = replaceBoardNode(node, {
          ...node,
          ...nextBounds,
        })
        const publicNode = materializeNode(stored)
        emit('node:resized', publicNode, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        })
        emit('node:updated', publicNode, materializeNode(node))
        return publicNode
      })
    },
    bringToFront(id) {
      runCommand('bringToFront', [id], () => {
        const node = assertBoardNode(id)
        const stored = replaceBoardNode(node, {
          ...node,
          zIndex: state.nextZIndex++,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    sendToBack(id) {
      runCommand('sendToBack', [id], () => {
        const node = assertBoardNode(id)
        const minZ = Math.min(
          ...Array.from(state.nodes.values(), (entry) => entry.zIndex),
        )
        const stored = replaceBoardNode(node, {
          ...node,
          zIndex: minZ - 1,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    lockNode(id) {
      runCommand('lockNode', [id], () => {
        const node = assertBoardNode(id)
        const stored = replaceBoardNode(node, {
          ...node,
          locked: true,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
      })
    },
    unlockNode(id) {
      runCommand('unlockNode', [id], () => {
        const node = assertBoardNode(id)
        const stored = replaceBoardNode(node, {
          ...node,
          locked: false,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
      })
    },
    duplicateNodes(ids, offset = { x: grid.size, y: grid.size }) {
      return runCommand('duplicateNodes', [ids, offset], () => {
        const forest = forestIdsFromSeeds(ids)
        const source = Array.from(forest)
          .map((id) => state.nodes.get(id))
          .filter((node): node is BoardNode => Boolean(node))
          .sort((a, b) => a.zIndex - b.zIndex)
        const duplicated = duplicateForest(source, offset)
        const created = duplicated.nodes
        for (const node of created) {
          state.nodes.set(node.id, node)
          emit('node:created', materializeNode(node))
        }
        notifyNodesChanged()
        setSelection(created.map((node) => node.id))
        return {
          nodes: created.map((node) => materializeNode(node)),
          idMap: duplicated.idMap,
        }
      })
    },
    copySelected() {
      return runCommand('copySelected', [], () => {
        clipboard.length = 0
        for (const node of getCopyClosureNodes()) {
          clipboard.push({ ...node })
        }
        return clipboard.map((node) => materializeNode(node))
      })
    },
    pasteClipboard(offset = { x: grid.size, y: grid.size }) {
      return runCommand('pasteClipboard', [offset], () => {
        const created = duplicateForest(clipboard, offset).nodes
        for (const node of created) {
          state.nodes.set(node.id, node)
          emit('node:created', materializeNode(node))
        }
        notifyNodesChanged()
        setSelection(created.map((node) => node.id))
        return created.map((node) => materializeNode(node))
      })
    },
    select(ids, mode = 'replace') {
      runCommand(
        'select',
        [ids, mode],
        () => {
          discardActiveInteraction()
          const resolved = Array.isArray(ids) ? ids : [ids]
          if (mode === 'replace') {
            setSelection(resolved)
            return
          }
          const next = new Set(state.selection)
          for (const id of resolved) {
            if (mode === 'toggle') {
              if (next.has(id)) {
                next.delete(id)
              } else {
                next.add(id)
              }
            } else {
              next.add(id)
            }
          }
          setSelection(next)
        },
        IGNORE_COMMAND,
      )
    },
    selectAll() {
      runCommand(
        'selectAll',
        [],
        () => {
          discardActiveInteraction()
          setSelection(
            Array.from(state.nodes.values())
              .filter((node) => node.visible)
              .map((node) => node.id),
          )
        },
        IGNORE_COMMAND,
      )
    },
    clearSelection() {
      runCommand(
        'clearSelection',
        [],
        () => {
          discardActiveInteraction()
          setSelection([])
        },
        IGNORE_COMMAND,
      )
    },
    deleteSelected() {
      runCommand('deleteSelected', [], () => {
        const deletingRoots = getSelectionNodes().filter((node) => !node.locked)
        const toDelete = new Set<NodeId>()
        for (const node of deletingRoots) {
          collectSubtreeIdSet(node.id, toDelete)
        }
        for (const deleteId of deletionOrderPostOrder(toDelete)) {
          const prevNode = state.nodes.get(deleteId)
          if (!prevNode) {
            continue
          }
          state.nodes.delete(deleteId)
          notifyNodeDeletedPlugins(prevNode.id)
          emit('node:deleted', deleteId, materializeNode(prevNode))
        }
        if (toDelete.size > 0) {
          notifyNodesChanged()
        }
        setSelection([])
        setInteraction({ mode: 'idle' })
      })
    },
    getSelection() {
      assertAlive()
      return Array.from(state.selection.values())
    },
    beginPan(pointerId, screenPoint) {
      runCommand(
        'beginPan',
        [pointerId, screenPoint],
        () => {
          discardActiveInteraction()
          setInteraction({
            mode: 'panning',
            pointerId,
            lastScreenPoint: { ...screenPoint },
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    beginNodeDrag(id, pointerId, screenPoint) {
      runCommand(
        'beginNodeDrag',
        [id, pointerId, screenPoint],
        () => {
          assertBoardNode(id)
          discardActiveInteraction()
          const node = assertBoardNode(id)
          if (node.locked) {
            return
          }
          activeGestureHistoryRoot = captureHistoryRoot()
          const initialSelection = state.selection.has(id)
            ? getSelectionNodes()
                .filter((entry) => !entry.locked)
                .map((entry) => entry.id)
            : [id]
          const nodeIds = collectUniformTranslationTargets(
            initialSelection,
            state.nodes as Map<NodeId, BoardNode>,
          )
          if (!state.selection.has(id)) {
            setSelection([id])
          }
          const startNodePositions = Object.fromEntries(
            nodeIds.map((nodeId) => {
              const current = assertBoardNode(nodeId)
              return [nodeId, { x: current.x, y: current.y }]
            }),
          ) as Record<NodeId, Point>
          setInteraction({
            mode: 'dragging-nodes',
            pointerId,
            nodeIds,
            startScreenPoint: { ...screenPoint },
            startNodePositions,
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    beginResize(id, handle, pointerId, screenPoint) {
      runCommand(
        'beginResize',
        [id, handle, pointerId, screenPoint],
        () => {
          assertBoardNode(id)
          discardActiveInteraction()
          const node = assertBoardNode(id)
          if (node.locked) {
            return
          }
          activeGestureHistoryRoot = captureHistoryRoot()
          setSelection([id])
          setInteraction({
            mode: 'resizing-node',
            pointerId,
            nodeId: id,
            handle,
            startScreenPoint: { ...screenPoint },
            startNodeBounds: {
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height,
            },
            aspectRatio: node.width / node.height,
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    beginBoxSelect(pointerId, screenPoint) {
      runCommand(
        'beginBoxSelect',
        [pointerId, screenPoint],
        () => {
          discardActiveInteraction()
          const worldPoint = engine.screenToWorld(screenPoint)
          activeBoxSelectionBefore = new Set(state.selection)
          setSelection([])
          setInteraction({
            mode: 'box-select',
            pointerId,
            selectionMode: resolveBoxSelectMode(screenPoint, screenPoint),
            startScreenPoint: { ...screenPoint },
            currentScreenPoint: { ...screenPoint },
            startWorldPoint: worldPoint,
            currentWorldPoint: worldPoint,
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    beginTextEdit(id) {
      runCommand(
        'beginTextEdit',
        [id],
        () => {
          const node = assertBoardNode(id)
          if (node.type !== 'text') {
            throw new BoardInputError(
              `Cannot edit text for ${node.type} node "${id}".`,
            )
          }
          discardActiveInteraction()
          setSelection([id])
          setInteraction({ mode: 'editing-text', nodeId: id })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    commitTextEdit(id, text) {
      return runCommand('commitTextEdit', [id, text], () => {
        const node = assertBoardNode(id)
        if (node.type !== 'text') {
          throw new BoardInputError(
            `Cannot edit text for ${node.type} node "${id}".`,
          )
        }
        let stored: BoardNode = node
        if (text !== undefined) {
          stored = replaceBoardNode(node, { ...node, text })
          emit('node:updated', materializeNode(stored), materializeNode(node))
        }
        setInteraction({ mode: 'idle' })
        return materializeNode(stored)
      })
    },
    cancelTextEdit() {
      if (state.interaction.mode !== 'editing-text') return
      runCommand(
        'cancelTextEdit',
        [],
        () => setInteraction({ mode: 'idle' }),
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    updatePointer(pointerId, screenPoint, modifiers) {
      const interaction = state.interaction
      if (
        interaction.mode === 'idle' ||
        interaction.mode === 'editing-text' ||
        interaction.pointerId !== pointerId
      ) {
        return
      }

      if (interaction.mode === 'panning') {
        runCommand(
          'updatePointer',
          [pointerId, screenPoint],
          () => {
            const deltaX = screenPoint.x - interaction.lastScreenPoint.x
            const deltaY = screenPoint.y - interaction.lastScreenPoint.y
            setCamera({
              x: state.camera.x + deltaX / state.camera.z,
              y: state.camera.y + deltaY / state.camera.z,
              z: state.camera.z,
            })
            setInteraction({
              ...interaction,
              lastScreenPoint: { ...screenPoint },
            })
          },
          IGNORE_UNVALIDATED_COMMAND,
        )
        return
      }

      if (interaction.mode === 'dragging-nodes') {
        runCommand(
          'updatePointer',
          [pointerId, screenPoint, modifiers],
          () => {
            const rawDeltaX =
              (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
            const rawDeltaY =
              (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
            const axisLocked = Boolean(modifiers?.shift)
            const deltaX =
              axisLocked && Math.abs(rawDeltaY) > Math.abs(rawDeltaX)
                ? 0
                : rawDeltaX
            const deltaY =
              axisLocked && Math.abs(rawDeltaX) >= Math.abs(rawDeltaY)
                ? 0
                : rawDeltaY
            const bypassSnapping = Boolean(modifiers?.space)
            const snapToGrid = grid.snap && !bypassSnapping
            const prelimBounds: Record<
              NodeId,
              { x: number; y: number; width: number; height: number }
            > = {}
            let minX = Infinity
            let minY = Infinity
            let maxX = -Infinity
            let maxY = -Infinity

            for (const nodeId of interaction.nodeIds) {
              const node = assertBoardNode(nodeId)
              const origin = interaction.startNodePositions[nodeId]
              if (!origin) {
                continue
              }
              const x = snapToGrid
                ? snapValue(origin.x + deltaX, grid.size)
                : origin.x + deltaX
              const y = snapToGrid
                ? snapValue(origin.y + deltaY, grid.size)
                : origin.y + deltaY
              prelimBounds[nodeId] = {
                x,
                y,
                width: node.width,
                height: node.height,
              }
              minX = Math.min(minX, x)
              minY = Math.min(minY, y)
              maxX = Math.max(maxX, x + node.width)
              maxY = Math.max(maxY, y + node.height)
            }

            const snapResult =
              bypassSnapping || !grid.edgeSnap
                ? { dx: 0, dy: 0, guides: [] as SnapGuide[] }
                : (() => {
                    const excludeIds = new Set(interaction.nodeIds)
                    const groupBounds = {
                      x: minX,
                      y: minY,
                      width: maxX - minX,
                      height: maxY - minY,
                    }
                    return snapPositionToEdges(
                      groupBounds,
                      getSnapEdgeIndex(),
                      grid.edgeSnapThreshold / state.camera.z,
                      excludeIds,
                    )
                  })()
            setSnapGuides(snapResult.guides)

            let movedNodeCount = 0
            for (const nodeId of interaction.nodeIds) {
              const current = assertBoardNode(nodeId)
              const preliminary = prelimBounds[nodeId]
              if (!preliminary) {
                continue
              }
              setNodeOverride({
                ...current,
                x: preliminary.x + snapResult.dx,
                y: preliminary.y + snapResult.dy,
              })
              movedNodeCount += 1
            }
            if (movedNodeCount > 0) {
              notifyNodesChanged()
            }
          },
          IGNORE_UNVALIDATED_COMMAND,
        )
        return
      }

      if (interaction.mode === 'resizing-node') {
        runCommand(
          'updatePointer',
          [pointerId, screenPoint, modifiers],
          () => {
            const node = assertBoardNode(interaction.nodeId)
            const deltaX =
              (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
            const deltaY =
              (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
            const constraints = {
              minWidth: nodeConstraints.minWidth,
              minHeight: nodeConstraints.minHeight,
            }
            const locked = Boolean(modifiers?.shift)
            const bypassSnapping = Boolean(modifiers?.space)
            const raw = locked
              ? applyResizeDeltaLocked(
                  interaction.startNodeBounds,
                  interaction.handle,
                  deltaX,
                  deltaY,
                  constraints,
                  interaction.aspectRatio,
                )
              : applyResizeDelta(
                  interaction.startNodeBounds,
                  interaction.handle,
                  deltaX,
                  deltaY,
                  constraints,
                )

            if (locked) {
              const nextBounds =
                !bypassSnapping && grid.snap
                  ? snapResizedBoundsLocked(
                      raw,
                      interaction.startNodeBounds,
                      interaction.handle,
                      grid.size,
                      constraints,
                      interaction.aspectRatio,
                    )
                  : raw
              setSnapGuides([])
              setNodeOverride({
                ...node,
                ...nextBounds,
              })
            } else {
              const gridSnapped =
                !bypassSnapping && grid.snap
                  ? snapResizedBounds(
                      raw,
                      interaction.handle,
                      grid.size,
                      constraints,
                    )
                  : raw
              if (bypassSnapping || !grid.edgeSnap) {
                setSnapGuides([])
                setNodeOverride({
                  ...node,
                  ...gridSnapped,
                })
              } else {
                const snapResult = snapBoundsToEdges(
                  gridSnapped,
                  interaction.handle,
                  getSnapEdgeIndex(),
                  grid.edgeSnapThreshold / state.camera.z,
                  new Set([interaction.nodeId]),
                )
                setSnapGuides(snapResult.guides)
                setNodeOverride({
                  ...node,
                  ...snapResult.bounds,
                })
              }
            }
            notifyNodesChanged()
          },
          IGNORE_UNVALIDATED_COMMAND,
        )
        return
      }

      runCommand(
        'updatePointer',
        [pointerId, screenPoint],
        () => {
          const currentWorldPoint = engine.screenToWorld(screenPoint)
          const bounds = getBoundsFromPoints(
            interaction.startWorldPoint,
            currentWorldPoint,
          )
          const selectionMode = resolveBoxSelectMode(
            interaction.startScreenPoint,
            screenPoint,
          )
          const matches = Array.from(state.nodes.values())
            .filter((node) => node.visible)
            .filter((node) =>
              selectionMode === 'window'
                ? boundsContain(bounds, getBoundsFromNode(node))
                : boundsIntersect(getBoundsFromNode(node), bounds),
            )
            .map((node) => node.id)
          setSelection(matches)
          setInteraction({
            ...interaction,
            selectionMode,
            currentScreenPoint: { ...screenPoint },
            currentWorldPoint,
          })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    endInteraction(pointerId) {
      const interaction = state.interaction
      if (interaction.mode === 'idle') {
        return
      }
      if (
        'pointerId' in interaction &&
        pointerId !== undefined &&
        interaction.pointerId !== pointerId
      ) {
        return
      }
      const gestureCommit =
        activeGestureHistoryRoot &&
        (interaction.mode === 'dragging-nodes' ||
          interaction.mode === 'resizing-node')
          ? {
              before: activeGestureHistoryRoot,
              label:
                interaction.mode === 'dragging-nodes'
                  ? 'moveNodes'
                  : 'resizeNode',
              metadata: RECORD_COMMAND,
            }
          : undefined
      runCommand(
        'endInteraction',
        [pointerId],
        () => {
          const previous = state.interaction
          setSnapGuides([])
          if (previous.mode === 'dragging-nodes') {
            commitNodeOverrides(previous)
            reparentAfterDrag(previous.nodeIds)
            reparentNodesCapturedByMovedGroups(previous.nodeIds)
          }
          if (previous.mode === 'resizing-node') {
            commitNodeOverrides(previous)
            reparentNodesCapturedByGroups([previous.nodeId], [previous.nodeId])
          }
          setInteraction({ mode: 'idle' })
        },
        gestureCommit ? RECORD_COMMAND : IGNORE_COMMAND,
        gestureCommit,
      )
      activeGestureHistoryRoot = null
      activeBoxSelectionBefore = null
    },
    cancelInteraction(pointerId) {
      const interaction = state.interaction
      if (interaction.mode === 'idle') return
      if (
        'pointerId' in interaction &&
        pointerId !== undefined &&
        interaction.pointerId !== pointerId
      ) {
        return
      }
      runCommand(
        'cancelInteraction',
        [pointerId],
        () => {
          discardActiveInteraction()
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    getUniformTranslationTargets(seedIds) {
      assertAlive()
      return collectUniformTranslationTargets(
        seedIds,
        state.nodes as Map<NodeId, BoardNode>,
      )
    },
    syncGroupZOrder(groupId) {
      runCommand('syncGroupZOrder', [groupId], () => {
        assertBoardNode(groupId)
        restackGroupDescendantsAbove(groupId)
      })
    },
    exportDocument() {
      assertAlive()
      const pluginDocuments = Array.from(
        pluginPersistence.values(),
        (entry) => entry.hooks.exportDocument?.(entry.context) ?? {},
      )
      return toPersistedDocument(
        buildSnapshot(state, grid, buildPublicNodeMap(state)),
        pluginDocuments,
      )
    },
    loadDocument(document, options = {}) {
      const mode = options.mode ?? 'replace'
      runCommand(
        'loadDocument',
        [mode],
        () => {
          const normalized = normalizeDocumentForImport(document)
          assertCanRestoreDocument(normalized)
          const snapshot = documentToSnapshot(normalized)
          nodeOverrides.clear()
          activeGestureHistoryRoot = null
          activeBoxSelectionBefore = null
          const idMap = restoreSnapshot(snapshot, mode)
          restorePluginDocuments(normalized, mode, idMap)
        },
        IGNORE_COMMAND,
      )
    },
  }

  notifyNodesChanged()

  for (const plugin of options.plugins ?? []) {
    assertInternalBoardPlugin(plugin)
    installPlugin(plugin)
  }

  if (initialDocument) {
    assertCanRestoreDocument(initialDocument)
    runCommand(
      'initializeDocument',
      [],
      () => restorePluginDocuments(initialDocument, 'replace'),
      IGNORE_COMMAND,
    )
  }

  validate('createBoardEngine')

  const internalKeys = new Set([
    'emit',
    'assertActive',
    'isBatching',
    'extend',
    'runCommand',
    'projectCommit',
    'restoreHistoryRoot',
    'getPluginState',
    'updatePluginState',
    'beginPan',
    'beginNodeDrag',
    'beginResize',
    'beginBoxSelect',
    'updatePointer',
    'endInteraction',
    'cancelInteraction',
    'getUniformTranslationTargets',
    'syncGroupZOrder',
  ])
  const publicEngine = Object.fromEntries(
    Object.entries(engine).filter(([key]) => !internalKeys.has(key)),
  ) as unknown as BoardEngine<
    InstalledPluginApis<TPlugins>,
    InstalledPluginEvents<TPlugins>
  >
  registerBoardInteractionAdapter(publicEngine, engine)
  return publicEngine
}
