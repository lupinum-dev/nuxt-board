import {
  boundsContain,
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
  lerpCamera,
  pointInBounds,
  screenToWorld,
  snapPoint,
  snapSize,
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
import { cloneInteraction } from './invariants.js'
import {
  applyResizeDelta,
  applyResizeDeltaLocked,
  snapResizedBounds,
  snapResizedBoundsLocked,
} from './resize.js'
import {
  collectOtherNodeEdges,
  collectOtherNodeEdgesExcluding,
  snapBoundsToEdges,
  snapPositionToEdges,
} from './snap.js'
import { freezeClone } from './helpers/clone.js'
import { createNodeId } from './helpers/ids.js'
import {
  AnimationCancelled,
  getAnimationFrameDriver,
} from './helpers/animation.js'
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
  documentToSnapshot,
  materializeSnapshotNodes,
  normalizeDocumentForImport,
  normalizeNodeType,
  toPersistedDocument,
  withNodeFields,
} from './engine/persistence.js'
import { assertInternalBoardPlugin } from './internal.js'
import {
  BoardConflictError,
  BoardDestroyedError,
  BoardError,
  BoardNotFoundError,
} from './errors.js'
import {
  validateBoardConfiguration,
  validateGridSettings,
} from './engine/options.js'
import type {
  BoxSelectBehavior,
  BoxSelectMode,
  BoardSnapshot,
  BoardState,
  Bounds,
  Camera,
  BoardEngine,
  BoardEngineOptions,
  BoardNode,
  GridSettings,
  InternalBoardPlugin,
  InternalPluginContext,
  InstalledPluginApis,
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
  ) {
    super(`Command "${command}" was blocked by a command guard.`)
    this.name = 'CommandBlockedError'
  }
}

const CONNECTIONS_FEATURE_NAME = 'connections'
const RECORD_COMMAND: CommandMetadata = { history: 'record' }
const IGNORE_COMMAND: CommandMetadata = { history: 'ignore' }
type RuntimeCommandMetadata = CommandMetadata & { validate?: false }
const IGNORE_UNVALIDATED_COMMAND: RuntimeCommandMetadata = {
  history: 'ignore',
  validate: false,
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
): BoardEngine<InstalledPluginApis<TPlugins>> {
  const camera: Camera = { ...DEFAULT_CAMERA, ...options.camera }
  const zoom: ZoomSettings = { ...DEFAULT_ZOOM, ...options.zoom }
  const grid: GridSettings = { ...DEFAULT_GRID, ...options.grid }
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

  const eventBus = createEventBus({ diagnosticsEnabled, traceLimit })
  const { emit, emitImmediate, on, once, off } = eventBus
  const commandGuards = createCommandGuardRegistry()
  const commitListeners = new Set<(commit: InternalBoardCommit) => void>()
  const nodeDeletedHooks = new Set<(nodeId: NodeId) => void>()
  const pluginCleanups = new Map<string, () => void>()
  const pluginStates = new Map<
    string,
    {
      state: unknown
    }
  >()
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
  let animationToken = 0
  let destroyed = false
  let activeGestureHistoryRoot: InternalHistoryRoot | null = null
  const nodeOverrides = new Map<NodeId, BoardNode>()

  function assertAlive(): void {
    if (destroyed) {
      throw new BoardDestroyedError()
    }
  }

  const state: MutableBoardState = {
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
    state,
    grid,
    emit,
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

  const batches = createBatchCommandController({
    batchCtrl,
    emitCommandBefore: (name, args, metadata) =>
      emitImmediate('command:before', name, args, metadata),
    emitCommandAfter: (name, args, duration, metadata) =>
      emitImmediate('command:after', name, args, duration, metadata),
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

  function getSnapshot(): BoardSnapshot {
    assertAlive()
    return buildSnapshot(state, grid, getPublicNodeMap())
  }

  function getState(): BoardState {
    assertAlive()
    return buildPublicState(state, grid, getPublicNodeMap())
  }

  interface EngineRestorePoint {
    camera: Camera
    nodes: Map<NodeId, BoardNode>
    selection: Set<NodeId>
    interaction: InteractionState
    snapGuides: SnapGuide[]
    nextZIndex: number
    grid: GridSettings
    pluginStatesSnapshot: Map<string, unknown>
  }

  function createRestorePoint(): EngineRestorePoint {
    return {
      camera: { ...state.camera },
      nodes: new Map(state.nodes),
      selection: new Set(state.selection),
      interaction: cloneInteraction(state.interaction),
      snapGuides: state.snapGuides.map((guide) => ({ ...guide })),
      nextZIndex: state.nextZIndex,
      grid: { ...grid },
      pluginStatesSnapshot: new Map(
        Array.from(pluginStates, ([name, pluginState]) => [
          name,
          structuredClone(pluginState.state),
        ]),
      ),
    }
  }

  function captureHistoryRoot(): InternalHistoryRoot {
    return {
      nodes: new Map(state.nodes),
      grid: freezeClone({ ...grid }),
      selection: new Set(state.selection),
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

  function publishCommit(
    label: string,
    metadata: CommandMetadata,
    before: InternalHistoryRoot,
  ): void {
    const after = captureHistoryRoot()
    if (sameHistoryRoot(before, after)) return
    const commit: InternalBoardCommit = Object.freeze({
      label,
      timestamp: Date.now(),
      metadata,
      before,
      after,
    })
    for (const listener of commitListeners) {
      listener(commit)
    }
  }

  function restoreEngineState(
    restorePoint: EngineRestorePoint,
    notify = true,
  ): void {
    state.camera = { ...restorePoint.camera }
    state.nodes = new Map(restorePoint.nodes)
    state.selection = new Set(restorePoint.selection)
    state.interaction = cloneInteraction(restorePoint.interaction)
    state.snapGuides = restorePoint.snapGuides.map((guide) => ({ ...guide }))
    state.nextZIndex = restorePoint.nextZIndex
    Object.assign(grid, restorePoint.grid)
    invalidateNodeCache()
    for (const [
      name,
      pluginStateSnapshot,
    ] of restorePoint.pluginStatesSnapshot) {
      const pluginState = pluginStates.get(name)
      if (pluginState) {
        pluginState.state = structuredClone(pluginStateSnapshot)
      }
    }
    if (notify) {
      notifyCameraChanged()
      notifyGridChanged()
      notifyNodesChanged()
      notifySelectionChanged()
      notifyInteractionChanged()
      notifySnapGuidesChanged()
    }
  }

  function runCommand<T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata: RuntimeCommandMetadata = RECORD_COMMAND,
  ): T {
    assertAlive()
    const validateCommand = metadata.validate !== false
    // Command guards run before any events are emitted.
    // If the chain doesn't call next(), the command is cancelled.
    if (!commandGuards.run(name, args)) {
      emitImmediate('command:blocked', name, args, metadata)
      throw new CommandBlockedError(name, args)
    }
    const started = performance.now()
    const inBatch = batches.isBatching()
    if (!inBatch) {
      emitImmediate('command:before', name, args, metadata)
    }
    const ownsEffects = batchCtrl.depth === 0
    if (ownsEffects) {
      batchCtrl.depth += 1
      eventBus.beginTransaction()
    }
    const restorePoint = validateCommand ? createRestorePoint() : null
    const historyBefore = ownsEffects ? captureHistoryRoot() : null
    try {
      const result = fn()
      if (validateCommand) {
        if (inBatch) {
          batches.markValidationPending()
        } else {
          validate(name)
        }
      }
      if (ownsEffects) {
        batchCtrl.depth -= 1
        batches.flushBatchNotifications()
        eventBus.commitTransaction()
      }
      if (!inBatch) {
        emitImmediate(
          'command:after',
          name,
          args,
          performance.now() - started,
          metadata,
        )
      }
      if (historyBefore) {
        publishCommit(name, metadata, historyBefore)
      }
      return result
    } catch (error) {
      if (restorePoint) {
        restoreEngineState(restorePoint, false)
      }
      if (ownsEffects) {
        batchCtrl.depth -= 1
        batches.rollbackBatchNotifications()
        eventBus.rollbackTransaction()
      }
      throw error
    }
  }

  async function runAsyncCommand<T>(
    name: string,
    args: unknown[],
    fn: () => Promise<T>,
    metadata: RuntimeCommandMetadata = RECORD_COMMAND,
  ): Promise<T> {
    assertAlive()
    const validateCommand = metadata.validate !== false
    if (!commandGuards.run(name, args)) {
      emitImmediate('command:blocked', name, args, metadata)
      throw new CommandBlockedError(name, args)
    }
    const started = performance.now()
    emitImmediate('command:before', name, args, metadata)
    const ownsEffects = batchCtrl.depth === 0
    if (ownsEffects) {
      batchCtrl.depth += 1
      eventBus.beginTransaction()
    }
    const restorePoint = validateCommand ? createRestorePoint() : null
    const historyBefore = ownsEffects ? captureHistoryRoot() : null
    try {
      const result = await fn()
      if (validateCommand) {
        validate(name)
      }
      if (ownsEffects) {
        batchCtrl.depth -= 1
        batches.flushBatchNotifications()
        eventBus.commitTransaction()
      }
      emitImmediate(
        'command:after',
        name,
        args,
        performance.now() - started,
        metadata,
      )
      if (historyBefore) {
        publishCommit(name, metadata, historyBefore)
      }
      return result
    } catch (error) {
      if (error instanceof AnimationCancelled) {
        if (ownsEffects) {
          batchCtrl.depth -= 1
          batches.rollbackBatchNotifications()
          eventBus.rollbackTransaction()
        }
        return undefined as T
      }
      if (restorePoint) {
        restoreEngineState(restorePoint, false)
      }
      if (ownsEffects) {
        batchCtrl.depth -= 1
        batches.rollbackBatchNotifications()
        eventBus.rollbackTransaction()
      }
      throw error
    }
  }

  const validate = createValidator({
    getState: () => getState(),
    getGrid: () => grid,
    emitFailure: (failure) => emitImmediate('validation:failed', failure),
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

  function assertValidNodeGeometry(
    id: NodeId,
    geometry: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  ): void {
    if (
      !Number.isFinite(geometry.x) ||
      !Number.isFinite(geometry.y) ||
      !Number.isFinite(geometry.width) ||
      !Number.isFinite(geometry.height) ||
      geometry.width <= 0 ||
      geometry.height <= 0
    ) {
      throw new Error(`Invalid node geometry for "${id}".`)
    }
  }

  function assertValidParentLink(
    id: NodeId,
    parentId: NodeId | undefined,
  ): void {
    if (parentId === undefined) {
      return
    }
    if (parentId === id) {
      throw new Error(`Node "${id}" cannot be its own parent.`)
    }
    const parent = state.nodes.get(parentId)
    if (!parent) {
      throw new Error(`Node "${id}" references missing parent "${parentId}".`)
    }
    if (parent.type !== 'group') {
      throw new Error(`Node "${id}" parent "${parentId}" must be a group.`)
    }
    let walk: BoardNode | undefined = parent
    const seen = new Set<NodeId>()
    while (walk) {
      if (walk.id === id || seen.has(walk.id)) {
        throw new Error(`Node "${id}" cannot create a parent cycle.`)
      }
      seen.add(walk.id)
      walk = walk.parentId ? state.nodes.get(walk.parentId) : undefined
    }
  }

  function normalizeNode(input: NodeInput): BoardNode {
    const rawPoint = { x: input.x ?? 0, y: input.y ?? 0 }
    const snappedPoint = grid.snap ? snapPoint(rawPoint, grid.size) : rawPoint
    const width = grid.snap
      ? snapSize(
          input.width ?? nodeConstraints.defaultWidth,
          grid.size,
          nodeConstraints.minWidth,
        )
      : (input.width ?? nodeConstraints.defaultWidth)
    const height = grid.snap
      ? snapSize(
          input.height ?? nodeConstraints.defaultHeight,
          grid.size,
          nodeConstraints.minHeight,
        )
      : (input.height ?? nodeConstraints.defaultHeight)
    const type = normalizeNodeType(input.type)
    const parentId =
      typeof input.parentId === 'string' && input.parentId.length > 0
        ? input.parentId
        : undefined
    const id = input.id ?? createNodeId()
    if (state.nodes.has(id)) {
      throw new BoardConflictError(
        `Cannot create node: node "${id}" already exists.`,
      )
    }
    assertValidNodeGeometry(id, {
      x: snappedPoint.x,
      y: snappedPoint.y,
      width,
      height,
    })
    assertValidParentLink(id, parentId)

    return withNodeFields(
      {
        id,
        type,
        x: snappedPoint.x,
        y: snappedPoint.y,
        width,
        height,
        color: input.color,
        zIndex: state.nextZIndex++,
        locked: Boolean(input.locked),
        visible: input.visible !== false,
        parentId,
      },
      input,
    )
  }

  function applyNodePatch(node: BoardNode, patch: NodePatch): BoardNode {
    const nextBase = {
      ...node,
      ...patch,
      parentId: 'parentId' in patch ? patch.parentId : node.parentId,
      color: 'color' in patch ? patch.color : node.color,
    }
    const x = grid.snap ? snapValue(nextBase.x, grid.size) : nextBase.x
    const y = grid.snap ? snapValue(nextBase.y, grid.size) : nextBase.y
    const width = grid.snap
      ? snapSize(nextBase.width, grid.size, nodeConstraints.minWidth)
      : nextBase.width
    const height = grid.snap
      ? snapSize(nextBase.height, grid.size, nodeConstraints.minHeight)
      : nextBase.height
    assertValidNodeGeometry(node.id, { x, y, width, height })
    assertValidParentLink(node.id, nextBase.parentId)

    return {
      ...nextBase,
      x,
      y,
      width,
      height,
    }
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

  function replaceBoardNodeAndDispatch(
    node: BoardNode,
    next: BoardNode,
  ): BoardNode {
    const stored = replaceBoardNode(node, next)
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
      current = replaceBoardNodeAndDispatch(node, {
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
      const updated = replaceBoardNodeAndDispatch(node, {
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

  async function animateCamera(target: Camera): Promise<void> {
    animationToken += 1
    const token = animationToken
    const start = { ...state.camera }
    const started = performance.now()
    const duration = 280
    const { raf } = getAnimationFrameDriver()

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (token !== animationToken) {
          reject(new AnimationCancelled())
          return
        }
        const elapsed = performance.now() - started
        const t = clamp(elapsed / duration, 0, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setCamera(lerpCamera(start, target, eased))
        if (t < 1) {
          raf(tick)
        } else {
          resolve()
        }
      }
      raf(tick)
    })
  }

  function computeFitCamera(ids: NodeId[] | null, padding = 40): Camera | null {
    const source = ids
      ? ids
          .map((id) => state.nodes.get(id))
          .filter((node): node is BoardNode => Boolean(node && node.visible))
      : Array.from(state.nodes.values()).filter((node) => node.visible)
    if (source.length === 0) {
      return null
    }
    const bounds = source.reduce<Bounds>((acc, node) => {
      const current = getBoundsFromNode(node)
      return {
        minX: Math.min(acc.minX, current.minX),
        minY: Math.min(acc.minY, current.minY),
        maxX: Math.max(acc.maxX, current.maxX),
        maxY: Math.max(acc.maxY, current.maxY),
      }
    }, getBoundsFromNode(source[0]!))

    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const zoomLevel = clamp(
      Math.min(
        (viewportSize.x - padding * 2) / width,
        (viewportSize.y - padding * 2) / height,
      ),
      zoom.min,
      zoom.max,
    )
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    }
    return {
      x: viewportSize.x / (2 * zoomLevel) - center.x,
      y: viewportSize.y / (2 * zoomLevel) - center.y,
      z: zoomLevel,
    }
  }

  function restoreSnapshot(
    snapshot: BoardSnapshot,
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
      entry.hooks.importDocument?.(entry.context, document, mode, idMap)
    }
  }

  function assertCanRestoreDocument(document: JsonCanvasDocument): void {
    if (
      document.edges?.length &&
      !pluginPersistence.has(CONNECTIONS_FEATURE_NAME)
    ) {
      throw new Error(
        'Invalid board document: edges require the connections plugin.',
      )
    }
  }

  function installPlugin(plugin: InternalBoardPlugin): void {
    if (pluginCleanups.has(plugin.name)) {
      return
    }
    if (plugin.slice) {
      pluginStates.set(plugin.name, {
        state: plugin.slice.initial,
      })
    }
    const pluginCtx: InternalPluginContext = Object.assign(
      Object.create(engine) as InternalPluginContext,
      {
        getPluginState: <S>(): S => {
          const entry = pluginStates.get(plugin.name)
          if (!entry) {
            throw new Error(
              `Plugin "${plugin.name}" did not register a persistent slice.`,
            )
          }
          return entry.state as S
        },
        updatePluginState: <S>(update: (current: S) => S): S => {
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

  const engine: InternalPluginContext = {
    plugins,
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
      destroyed = true
      animationToken += 1
      nodeOverrides.clear()
      for (const cleanup of pluginCleanups.values()) {
        cleanup()
      }
      emit('destroy')
      pluginCleanups.clear()
      pluginStates.clear()
      pluginPersistence.clear()
      commitListeners.clear()
      nodeDeletedHooks.clear()
      commandGuards.clear()
      eventBus.clear()
      destroyReactiveLayer()
    },
    extend(key, value) {
      ;(plugins as unknown as Record<string, unknown>)[key] = value as unknown
    },
    batch(fn) {
      assertAlive()
      const restorePoint = createRestorePoint()
      const historyBefore = captureHistoryRoot()
      eventBus.beginTransaction()
      try {
        batches.batch(fn)
        eventBus.commitTransaction()
        publishCommit('batch', RECORD_COMMAND, historyBefore)
      } catch (error) {
        restoreEngineState(restorePoint, false)
        eventBus.rollbackTransaction()
        throw error
      }
    },
    getState,
    getSnapshot,
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
    onCommit(listener) {
      assertAlive()
      commitListeners.add(listener)
      return () => commitListeners.delete(listener)
    },
    restoreHistoryRoot(root) {
      runCommand(
        'history:restore',
        [],
        () => {
          nodeOverrides.clear()
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
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z }
      return runAsyncCommand(
        'panTo',
        [worldPoint, animated],
        async () => {
          if (animated) {
            await animateCamera(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomAt(screenPoint, delta) {
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
            await animateCamera(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomToFit(padding = 40, animated = false) {
      return runAsyncCommand(
        'zoomToFit',
        [padding, animated],
        async () => {
          const target = computeFitCamera(null, padding)
          if (!target) {
            return
          }
          if (animated) {
            await animateCamera(target)
          } else {
            setCamera(target)
          }
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    zoomToNodes(ids, padding = 40, animated = false) {
      return runAsyncCommand(
        'zoomToNodes',
        [ids, padding, animated],
        async () => {
          const target = computeFitCamera(ids, padding)
          if (!target) {
            return
          }
          if (animated) {
            await animateCamera(target)
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
        const stored = replaceBoardNodeAndDispatch(current, next)
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
        const deltas: { id: NodeId; before: Point; after: Point }[] = []
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
          deltas.push({
            id: targetId,
            before: { x: current.x, y: current.y },
            after: { x: stored.x, y: stored.y },
          })
          emit('node:moved', publicNode, {
            x: publicNode.x - current.x,
            y: publicNode.y - current.y,
          })
          emit('node:updated', publicNode, materializeNode(current))
        }
        if (deltas.length > 0) {
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
        const deltas: { id: NodeId; before: Point; after: Point }[] = []
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
          deltas.push({
            id: targetId,
            before: { x: current.x, y: current.y },
            after: { x: stored.x, y: stored.y },
          })
          emit('node:moved', publicNode, {
            x: publicNode.x - current.x,
            y: publicNode.y - current.y,
          })
          emit('node:updated', publicNode, materializeNode(current))
        }
        if (deltas.length > 0) {
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
        const stored = replaceBoardNodeAndDispatch(node, {
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
        const stored = replaceBoardNodeAndDispatch(node, {
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
        const stored = replaceBoardNodeAndDispatch(node, {
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
        const stored = replaceBoardNodeAndDispatch(node, {
          ...node,
          locked: true,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
      })
    },
    unlockNode(id) {
      runCommand('unlockNode', [id], () => {
        const node = assertBoardNode(id)
        const stored = replaceBoardNodeAndDispatch(node, {
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
      return Array.from(state.selection.values())
    },
    beginPan(pointerId, screenPoint) {
      runCommand(
        'beginPan',
        [pointerId, screenPoint],
        () => {
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
          const worldPoint = engine.screenToWorld(screenPoint)
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
          assertBoardNode(id)
          setSelection([id])
          setInteraction({ mode: 'editing-text', nodeId: id })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    commitTextEdit(id, text) {
      return runCommand('commitTextEdit', [id, text], () => {
        const node = assertBoardNode(id)
        let stored = node
        if (text !== undefined) {
          stored = replaceBoardNodeAndDispatch(node, { ...node, text })
          emit('node:updated', materializeNode(stored), materializeNode(node))
        }
        setInteraction({ mode: 'idle' })
        return materializeNode(stored)
      })
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
                    const otherEdges = collectOtherNodeEdgesExcluding(
                      state.nodes.values(),
                      excludeIds,
                    )
                    const groupBounds = {
                      x: minX,
                      y: minY,
                      width: maxX - minX,
                      height: maxY - minY,
                    }
                    return snapPositionToEdges(
                      groupBounds,
                      otherEdges,
                      grid.edgeSnapThreshold / state.camera.z,
                    )
                  })()
            setSnapGuides(snapResult.guides)

            const moveDeltas: { id: NodeId; before: Point; after: Point }[] = []
            let movedNodeCount = 0
            for (const nodeId of interaction.nodeIds) {
              const current = assertBoardNode(nodeId)
              const preliminary = prelimBounds[nodeId]
              const origin = interaction.startNodePositions[nodeId]
              if (!preliminary || !origin) {
                continue
              }
              const before = { x: current.x, y: current.y }
              const stored = setNodeOverride({
                ...current,
                x: preliminary.x + snapResult.dx,
                y: preliminary.y + snapResult.dy,
              })
              movedNodeCount += 1
              if (stored.x !== before.x || stored.y !== before.y) {
                moveDeltas.push({
                  id: nodeId,
                  before,
                  after: { x: stored.x, y: stored.y },
                })
              }
            }
            if (moveDeltas.length > 0) {
            }
            if (movedNodeCount > 0) {
              notifyNodesChanged()
            }
          },
          IGNORE_COMMAND,
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
                const otherEdges = collectOtherNodeEdges(
                  state.nodes.values(),
                  interaction.nodeId,
                )
                const snapResult = snapBoundsToEdges(
                  gridSnapped,
                  interaction.handle,
                  otherEdges,
                  grid.edgeSnapThreshold / state.camera.z,
                )
                setSnapGuides(snapResult.guides)
                setNodeOverride({
                  ...node,
                  ...snapResult.bounds,
                })
              }
            }
          },
          IGNORE_COMMAND,
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
        IGNORE_COMMAND,
      )
      if (
        activeGestureHistoryRoot &&
        (interaction.mode === 'dragging-nodes' ||
          interaction.mode === 'resizing-node')
      ) {
        publishCommit(
          interaction.mode === 'dragging-nodes' ? 'moveNodes' : 'resizeNode',
          RECORD_COMMAND,
          activeGestureHistoryRoot,
        )
      }
      activeGestureHistoryRoot = null
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
    exportJSON() {
      assertAlive()
      const pluginDocuments = Array.from(
        pluginPersistence.values(),
        (entry) => entry.hooks.exportDocument?.(entry.context) ?? {},
      )
      return JSON.stringify(
        toPersistedDocument(
          buildSnapshot(state, grid, buildPublicNodeMap(state)),
          pluginDocuments,
        ),
      )
    },
    importJSON(json, mode = 'replace') {
      runCommand(
        'importJSON',
        [mode],
        () => {
          nodeOverrides.clear()
          const document = normalizeDocumentForImport(JSON.parse(json))
          assertCanRestoreDocument(document)
          const snapshot = documentToSnapshot(document)
          const idMap = restoreSnapshot(snapshot, mode)
          restorePluginDocuments(document, mode, idMap)
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
    restorePluginDocuments(initialDocument, 'replace')
  }

  validate('createBoardEngine')

  return engine as unknown as BoardEngine<InstalledPluginApis<TPlugins>>
}
