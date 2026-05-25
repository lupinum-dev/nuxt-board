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
import type { StoredNode } from './state/versioning.js'
import { ZERO_VERSIONS, bumpVersions } from './state/versioning.js'
import type { MutableBoardState } from './state/types.js'
import {
  DEFAULT_CAMERA,
  DEFAULT_GRID,
  DEFAULT_NODE_CONSTRAINTS,
  DEFAULT_VIEWPORT_SIZE,
  DEFAULT_ZOOM,
} from './state/types.js'
import { normalizeExistingNode } from './state/initial.js'
import { materializeNode as materializeNodePure } from './helpers/node-shape.js'
import { buildPublicState, buildSnapshot } from './state/selectors.js'
import {
  duplicateForest as duplicateForestPure,
  getCopyClosureNodes as getCopyClosureNodesPure,
  getSelectionNodes as getSelectionNodesPure,
} from './helpers/selection-helpers.js'
import { createEventBus } from './engine/events.js'
import {
  createBatchCommandController,
  createCommandGuardRegistry,
  createDispatcher,
  createValidator,
} from './engine/command-runtime.js'
import { createReactiveLayer } from './engine/subscribables.js'
import { invertAction } from './engine/invert.js'
import {
  documentToSnapshot,
  materializeSnapshotNodes,
  normalizeDocumentForImport,
  normalizeNodeType,
  toPersistedDocument,
  withNodeFields,
} from './engine/persistence.js'
import { assertInternalBoardFeature } from './internal.js'
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
  InternalBoardFeature,
  InternalFeatureContext,
  BoardFeatureExtensions,
  CommandMetadata,
  InteractionState,
  ValidationMode,
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

export class CommandBlockedError extends Error {
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
const IGNORE_UNVALIDATED_COMMAND: CommandMetadata = {
  history: 'ignore',
  validate: false,
}

/**
 * Create a headless board engine with commands, reactive state, and internal feature hooks.
 *
 * @example
 * const engine = createBoardEngine({
 *   initialNodes: [{ id: asNodeId('a'), type: 'text', x: 0, y: 0, width: 160, height: 80, text: 'Hello', zIndex: 1, locked: false, visible: true }],
 * })
 */
export function createBoardEngine(
  options: BoardEngineOptions = {},
): BoardEngine {
  const camera: Camera = { ...DEFAULT_CAMERA, ...options.camera }
  const zoom: ZoomSettings = { ...DEFAULT_ZOOM, ...options.zoom }
  const grid: GridSettings = { ...DEFAULT_GRID, ...options.grid }
  const boxSelectBehavior: BoxSelectBehavior =
    options.boxSelect?.behavior ?? 'autocad'
  const nodeConstraints: NodeConstraints = {
    ...DEFAULT_NODE_CONSTRAINTS,
    ...options.nodes,
  }
  const validationMode: ValidationMode = options.validation ?? 'strict'
  const diagnosticsEnabled = options.diagnostics !== false
  const traceLimit =
    typeof options.diagnostics === 'object' && options.diagnostics.traceLimit
      ? options.diagnostics.traceLimit
      : 500

  const eventBus = createEventBus({ diagnosticsEnabled, traceLimit })
  const { emit, on, once, off } = eventBus
  const commandGuards = createCommandGuardRegistry()
  const dispatcher = createDispatcher()
  const featureCleanups = new Map<string, () => void>()
  const featureStates = new Map<
    string,
    {
      reducer: (
        state: unknown,
        action: import('./state/actions.js').Action,
      ) => unknown
      invert?: (innerAction: unknown) => unknown
      state: unknown
    }
  >()
  const featurePersistence = new Map<
    string,
    {
      context: InternalFeatureContext
      hooks: NonNullable<InternalBoardFeature['persistence']>
    }
  >()
  function reduceFeatureStates(
    action: import('./state/actions.js').Action,
  ): void {
    for (const featureState of featureStates.values()) {
      featureState.state = featureState.reducer(featureState.state, action)
    }
  }

  function dispatchAction(action: import('./state/actions.js').Action): void {
    reduceFeatureStates(action)
    dispatcher.dispatch(action)
  }
  const clipboard: StoredNode[] = []
  const ext = {} as BoardFeatureExtensions
  let viewportSize = { ...DEFAULT_VIEWPORT_SIZE }
  let animationToken = 0
  let destroyed = false

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
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }

  const reactive = createReactiveLayer({
    state,
    emit,
    dispatch: dispatchAction,
  })
  const {
    batchCtrl,
    $camera,
    $nodes,
    $selection,
    $interaction,
    $snapGuides,
    getPublicNodeMap,
    invalidateNodeCache,
    notifyNodesChanged,
    notifyCameraChanged,
    notifySelectionChanged,
    notifyInteractionChanged,
    notifySnapGuidesChanged,
    setCamera,
    setSelection,
    setInteraction,
    setSnapGuides,
  } = reactive

  const batches = createBatchCommandController({
    batchCtrl,
    emitCommandBefore: (name, args, metadata) =>
      emit('command:before', name, args, metadata),
    emitCommandAfter: (name, args, duration, metadata) =>
      emit('command:after', name, args, duration, metadata),
    validate: (ctx) => validate(ctx),
  })

  function getGridSettings(): GridSettings {
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
    return freezeClone({ ...viewportSize })
  }

  function dispatchNextZIndexChange(before: number): void {
    if (before === state.nextZIndex) {
      return
    }
    dispatchAction({
      type: 'NEXT_Z_INDEX_BUMPED',
      before,
      after: state.nextZIndex,
    })
  }

  function materializeNode(node: StoredNode): BoardNode {
    return materializeNodePure(node)
  }

  function getSnapshot(): BoardSnapshot {
    return buildSnapshot(state, grid, getPublicNodeMap())
  }

  function getState(): BoardState {
    return buildPublicState(state, getPublicNodeMap())
  }

  interface EngineRestorePoint {
    camera: Camera
    nodes: Map<NodeId, StoredNode>
    selection: Set<NodeId>
    interaction: InteractionState
    snapGuides: SnapGuide[]
    nextZIndex: number
    grid: GridSettings
    featureStatesSnapshot: Map<string, unknown>
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
      featureStatesSnapshot: new Map(
        Array.from(featureStates, ([name, featureState]) => [
          name,
          structuredClone(featureState.state),
        ]),
      ),
    }
  }

  function restoreEngineState(restorePoint: EngineRestorePoint): void {
    state.camera = { ...restorePoint.camera }
    state.nodes = new Map(restorePoint.nodes)
    state.selection = new Set(restorePoint.selection)
    state.interaction = cloneInteraction(restorePoint.interaction)
    state.snapGuides = restorePoint.snapGuides.map((guide) => ({ ...guide }))
    state.nextZIndex = restorePoint.nextZIndex
    Object.assign(grid, restorePoint.grid)
    for (const [
      name,
      featureStateSnapshot,
    ] of restorePoint.featureStatesSnapshot) {
      const featureState = featureStates.get(name)
      if (featureState) {
        featureState.state = structuredClone(featureStateSnapshot)
      }
    }
    notifyCameraChanged()
    notifyNodesChanged()
    notifySelectionChanged()
    notifyInteractionChanged()
    notifySnapGuidesChanged()
  }

  function runCommand<T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata: CommandMetadata = RECORD_COMMAND,
  ): T {
    const validateCommand = metadata.validate !== false
    // Command guards run before any events are emitted.
    // If the chain doesn't call next(), the command is cancelled.
    if (!commandGuards.run(name, args)) {
      emit('command:blocked', name, args, metadata)
      throw new CommandBlockedError(name, args)
    }
    const started = performance.now()
    const inBatch = batches.isBatching()
    if (!inBatch) {
      emit('command:before', name, args, metadata)
    }
    const restorePoint = validateCommand ? createRestorePoint() : null
    dispatcher.beginActionTransaction()
    try {
      const result = fn()
      if (validateCommand) {
        if (inBatch) {
          batches.markValidationPending()
        } else {
          validate(name)
        }
      }
      dispatcher.commitActionTransaction()
      if (!inBatch) {
        emit('command:after', name, args, performance.now() - started, metadata)
      }
      return result
    } catch (error) {
      if (restorePoint) {
        restoreEngineState(restorePoint)
      }
      dispatcher.rollbackActionTransaction()
      throw error
    }
  }

  async function runAsyncCommand<T>(
    name: string,
    args: unknown[],
    fn: () => Promise<T>,
    metadata: CommandMetadata = RECORD_COMMAND,
  ): Promise<T> {
    const validateCommand = metadata.validate !== false
    if (!commandGuards.run(name, args)) {
      emit('command:blocked', name, args, metadata)
      throw new CommandBlockedError(name, args)
    }
    const started = performance.now()
    emit('command:before', name, args, metadata)
    const restorePoint = validateCommand ? createRestorePoint() : null
    dispatcher.beginActionTransaction()
    try {
      const result = await fn()
      if (validateCommand) {
        validate(name)
      }
      dispatcher.commitActionTransaction()
      emit('command:after', name, args, performance.now() - started, metadata)
      return result
    } catch (error) {
      if (error instanceof AnimationCancelled) {
        dispatcher.rollbackActionTransaction()
        return undefined as T
      }
      if (restorePoint) {
        restoreEngineState(restorePoint)
      }
      dispatcher.rollbackActionTransaction()
      throw error
    }
  }

  const validate = createValidator({
    validationMode,
    getState: () => getState(),
    getGrid: () => grid,
    emitFailure: (failure) => emit('validation:failed', failure),
  })

  function assertStoredNode(id: NodeId): StoredNode {
    const node = state.nodes.get(id)
    if (!node) {
      throw new Error(`Node "${id}" does not exist.`)
    }
    return node
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
    let walk: StoredNode | undefined = parent
    const seen = new Set<NodeId>()
    while (walk) {
      if (walk.id === id || seen.has(walk.id)) {
        throw new Error(`Node "${id}" cannot create a parent cycle.`)
      }
      seen.add(walk.id)
      walk = walk.parentId ? state.nodes.get(walk.parentId) : undefined
    }
  }

  function normalizeNode(input: NodeInput): StoredNode {
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
        ...ZERO_VERSIONS,
      },
      input,
    )
  }

  function applyNodePatch(node: StoredNode, patch: NodePatch): StoredNode {
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
      version: node.version,
      geometryVersion: node.geometryVersion,
      dataVersion: node.dataVersion,
    }
  }

  function replaceStoredNodeWithoutNotify(
    node: StoredNode,
    next: StoredNode,
  ): StoredNode {
    const stored = bumpVersions(node, next)
    state.nodes.set(node.id, stored)
    invalidateNodeCache()
    return stored
  }

  function replaceStoredNode(node: StoredNode, next: StoredNode): StoredNode {
    const stored = replaceStoredNodeWithoutNotify(node, next)
    notifyNodesChanged()
    return stored
  }

  function replaceStoredNodeAndDispatch(
    node: StoredNode,
    next: StoredNode,
  ): StoredNode {
    const stored = replaceStoredNode(node, next)
    dispatchAction({
      type: 'NODE_UPDATED',
      id: node.id,
      before: node,
      after: stored,
    })
    return stored
  }

  function emitNodeResize(before: StoredNode, after: StoredNode): void {
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
    return materializeNode(assertStoredNode(id))
  }

  function bumpNodeToFront(id: NodeId): void {
    const node = state.nodes.get(id)
    if (!node) {
      return
    }
    const nextZIndexBefore = state.nextZIndex
    const next = replaceStoredNodeAndDispatch(node, {
      ...node,
      zIndex: state.nextZIndex++,
    })
    dispatchNextZIndexChange(nextZIndexBefore)
    emit('node:updated', materializeNode(next), materializeNode(node))
    restackGroupDescendantsAbove(id)
  }

  function getDirectChildren(parentId: NodeId): StoredNode[] {
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
    parent: StoredNode | null,
    nodeId: NodeId,
  ): void {
    const node = state.nodes.get(nodeId)
    if (!node) {
      return
    }
    let current = node
    if (parent && current.zIndex <= parent.zIndex) {
      const nextZIndexBefore = state.nextZIndex
      current = replaceStoredNodeAndDispatch(node, {
        ...node,
        zIndex: state.nextZIndex++,
      })
      dispatchNextZIndexChange(nextZIndexBefore)
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
      const updated = replaceStoredNodeAndDispatch(node, {
        ...node,
        parentId: nextParent,
      })
      emit('node:updated', materializeNode(updated), materializeNode(node))
      fixSubtreeZOrderAfter(
        nextParent ? assertStoredNode(nextParent) : null,
        id,
      )
    }
  }

  function reparentNodesCapturedByGroups(
    groupIds: NodeId[],
    excludeIds: Iterable<NodeId>,
  ): void {
    const exclude = new Set(excludeIds)
    const groups = groupIds
      .map((id) => state.nodes.get(id))
      .filter((node): node is StoredNode => Boolean(node))
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

  function getSelectionNodes(): StoredNode[] {
    return getSelectionNodesPure(state)
  }

  function getCopyClosureNodes(): StoredNode[] {
    return getCopyClosureNodesPure(state)
  }

  function duplicateForest(nodes: StoredNode[], offset: Point): StoredNode[] {
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
          .filter((node): node is StoredNode => Boolean(node && node.visible))
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
        dispatchAction({ type: 'NODE_DELETED', node: prevNode })
        emit('node:deleted', id, materializeNode(prevNode))
      }

      state.nextZIndex =
        snapshot.nextZIndex ??
        snapshotNodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
      for (const rawNode of snapshotNodes) {
        const node = normalizeExistingNode(rawNode)
        state.nodes.set(node.id, node)
        idMap.set(rawNode.id, node.id)
        dispatchAction({ type: 'NODE_CREATED', node })
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

  function restoreFeatureDocuments(
    document: JsonCanvasDocument,
    mode: 'replace' | 'merge',
    idMap: ReadonlyMap<NodeId, NodeId> = new Map(),
  ): void {
    for (const entry of featurePersistence.values()) {
      entry.hooks.importDocument?.(entry.context, document, mode, idMap)
    }
  }

  function assertCanRestoreDocument(document: JsonCanvasDocument): void {
    if (
      document.edges?.length &&
      !featurePersistence.has(CONNECTIONS_FEATURE_NAME)
    ) {
      throw new Error(
        'Invalid board document: edges require the connections extension.',
      )
    }
  }

  function applyRecordedAction(
    action: import('./state/actions.js').Action,
  ): void {
    switch (action.type) {
      case 'NODE_CREATED': {
        state.nodes.set(action.node.id, action.node)
        notifyNodesChanged()
        emit('node:created', materializeNode(action.node))
        break
      }
      case 'NODE_DELETED': {
        const prev = state.nodes.get(action.node.id)
        if (!prev) return
        state.nodes.delete(action.node.id)
        if (state.selection.has(action.node.id)) {
          const nextSelection = new Set(state.selection)
          nextSelection.delete(action.node.id)
          state.selection = nextSelection
          reactive.notifySelectionChanged()
        }
        notifyNodesChanged()
        emit('node:deleted', action.node.id, materializeNode(prev))
        break
      }
      case 'NODE_UPDATED': {
        state.nodes.set(action.id, action.after)
        notifyNodesChanged()
        emit(
          'node:updated',
          materializeNode(action.after),
          materializeNode(action.before),
        )
        break
      }
      case 'NODES_MOVED': {
        for (const delta of action.deltas) {
          const current = state.nodes.get(delta.id)
          if (!current) continue
          const next = bumpVersions(current, {
            ...current,
            x: delta.after.x,
            y: delta.after.y,
          })
          state.nodes.set(delta.id, next)
          emit('node:moved', materializeNode(next), {
            x: delta.after.x - delta.before.x,
            y: delta.after.y - delta.before.y,
          })
          emit('node:updated', materializeNode(next), materializeNode(current))
        }
        if (action.deltas.length > 0) notifyNodesChanged()
        break
      }
      case 'SELECTION_SET': {
        const prev = Array.from(state.selection.values())
        state.selection = new Set(action.after)
        reactive.notifySelectionChanged()
        emit('selection:change', [...action.after], prev)
        break
      }
      case 'GRID_UPDATED': {
        Object.assign(grid, action.after)
        break
      }
      case 'NEXT_Z_INDEX_BUMPED': {
        state.nextZIndex = action.after
        break
      }
      case 'BATCH': {
        for (const inner of action.actions) applyRecordedAction(inner)
        return
      }
      case 'FEATURE_ACTION':
        // Feature slice updates and side-effect listeners run via dispatchAction below.
        break
    }
    dispatchAction(action)
  }

  function invertActionImpl(
    action: import('./state/actions.js').Action,
  ): import('./state/actions.js').Action {
    return invertAction(
      action,
      (featureName) => featureStates.get(featureName)?.invert,
    )
  }

  function installFeature(feature: InternalBoardFeature): void {
    if (featureCleanups.has(feature.name)) {
      return
    }
    if (feature.slice) {
      featureStates.set(feature.name, {
        reducer: feature.slice.reducer as (
          state: unknown,
          action: import('./state/actions.js').Action,
        ) => unknown,
        invert: feature.slice.invert as
          | ((innerAction: unknown) => unknown)
          | undefined,
        state: feature.slice.initial,
      })
    }
    const featureCtx: InternalFeatureContext = Object.assign(
      Object.create(engine) as InternalFeatureContext,
      {
        getFeatureState: <S>(): S => {
          const entry = featureStates.get(feature.name)
          if (!entry) {
            throw new Error(
              `Feature "${feature.name}" did not register a slice; getFeatureState is unavailable.`,
            )
          }
          return entry.state as S
        },
      },
    )
    const cleanup = feature.install(featureCtx)
    if (feature.persistence) {
      featurePersistence.set(feature.name, {
        context: featureCtx,
        hooks: feature.persistence,
      })
    }
    featureCleanups.set(feature.name, cleanup ?? (() => undefined))
  }

  const engine: InternalFeatureContext = {
    ext,
    $camera,
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
      for (const cleanup of featureCleanups.values()) {
        cleanup()
      }
      featureCleanups.clear()
      featureStates.clear()
      featurePersistence.clear()
      emit('destroy')
    },
    extend(key, value) {
      ;(ext as unknown as Record<string, unknown>)[key] = value as unknown
    },
    batch(fn) {
      const restorePoint = createRestorePoint()
      try {
        batches.batch(fn)
      } catch (error) {
        restoreEngineState(restorePoint)
        throw error
      }
    },
    getState,
    getSnapshot,
    getGridSettings,
    getViewportSize,
    updateGridSettings(patch) {
      return runCommand('updateGridSettings', [patch], () => {
        const before = { ...grid }
        if (patch.size !== undefined) {
          grid.size = Math.max(1, Math.round(patch.size))
        }
        if (patch.majorEvery !== undefined) {
          grid.majorEvery = Math.max(1, Math.round(patch.majorEvery))
        }
        if (patch.snap !== undefined) {
          grid.snap = patch.snap
        }
        if (patch.edgeSnap !== undefined) {
          grid.edgeSnap = patch.edgeSnap
        }
        if (patch.edgeSnapThreshold !== undefined) {
          grid.edgeSnapThreshold = Math.max(1, patch.edgeSnapThreshold)
        }
        if (patch.pattern !== undefined) {
          grid.pattern = patch.pattern
        }
        dispatchAction({
          type: 'GRID_UPDATED',
          before,
          after: { ...grid },
        })
        return getGridSettings()
      })
    },
    setViewportSize(size) {
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
    on,
    once,
    off,
    exportTrace: eventBus.exportTrace,
    addCommandGuard: commandGuards.add,
    runCommand<T>(
      name: string,
      args: unknown[],
      fn: () => T,
      metadata: CommandMetadata,
    ): T {
      return runCommand(name, args, fn, metadata)
    },
    dispatch: dispatchAction,
    onAction: dispatcher.onAction,
    applyRecordedAction,
    invertAction: invertActionImpl,
    getFeatureState<S>(): S {
      throw new Error(
        'getFeatureState is only available inside a internal feature install() context.',
      )
    },
    screenToWorld(point) {
      return screenToWorld(point, state.camera)
    },
    worldToScreen(point) {
      return worldToScreen(point, state.camera)
    },
    getVisibleBounds(width, height) {
      return getVisibleBounds(width, height, state.camera)
    },
    getNode(id) {
      return getPublicNode(id)
    },
    findNode(id) {
      return state.nodes.has(id) ? getPublicNode(id) : null
    },
    hasNode(id) {
      return state.nodes.has(id)
    },
    getNodeAt(worldPoint) {
      let best: StoredNode | null = null
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
        const nextZIndexBefore = state.nextZIndex
        const node = normalizeNode(input)
        state.nodes.set(node.id, node)
        notifyNodesChanged()
        dispatchAction({ type: 'NODE_CREATED', node })
        dispatchNextZIndexChange(nextZIndexBefore)
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
        const current = assertStoredNode(id)
        const next = applyNodePatch(current, patch)
        const stored = replaceStoredNodeAndDispatch(current, next)
        const publicNode = materializeNode(stored)
        emit('node:updated', publicNode, materializeNode(current))
        return publicNode
      })
    },
    deleteNode(id) {
      runCommand('deleteNode', [id], () => {
        assertStoredNode(id)
        const toDelete = new Set<NodeId>()
        collectSubtreeIdSet(id, toDelete)
        for (const deleteId of deletionOrderPostOrder(toDelete)) {
          const prevNode = state.nodes.get(deleteId)
          if (!prevNode) {
            continue
          }
          state.nodes.delete(deleteId)
          dispatchAction({ type: 'NODE_DELETED', node: prevNode })
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
        const node = assertStoredNode(id)
        if (node.locked) {
          return materializeNode(node)
        }
        const targets = collectUniformTranslationTargets(
          [id],
          state.nodes as Map<NodeId, BoardNode>,
        )
        const deltas: { id: NodeId; before: Point; after: Point }[] = []
        for (const targetId of targets) {
          const current = assertStoredNode(targetId)
          const next = {
            ...current,
            x: grid.snap
              ? snapValue(current.x + dx, grid.size)
              : current.x + dx,
            y: grid.snap
              ? snapValue(current.y + dy, grid.size)
              : current.y + dy,
          }
          const stored = replaceStoredNodeWithoutNotify(current, next)
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
          dispatchAction({ type: 'NODES_MOVED', deltas })
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
          const current = assertStoredNode(targetId)
          const next = {
            ...current,
            x: grid.snap
              ? snapValue(current.x + dx, grid.size)
              : current.x + dx,
            y: grid.snap
              ? snapValue(current.y + dy, grid.size)
              : current.y + dy,
          }
          const stored = replaceStoredNodeWithoutNotify(current, next)
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
          dispatchAction({ type: 'NODES_MOVED', deltas })
          notifyNodesChanged()
        }
        reparentAfterDrag(targets)
        reparentNodesCapturedByMovedGroups(targets)
      })
    },
    resizeNode(id, handle, dx, dy) {
      return runCommand('resizeNode', [id, handle, dx, dy], () => {
        const node = assertStoredNode(id)
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
        const stored = replaceStoredNodeAndDispatch(node, {
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
        const node = assertStoredNode(id)
        const nextZIndexBefore = state.nextZIndex
        const stored = replaceStoredNodeAndDispatch(node, {
          ...node,
          zIndex: state.nextZIndex++,
        })
        dispatchNextZIndexChange(nextZIndexBefore)
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    sendToBack(id) {
      runCommand('sendToBack', [id], () => {
        const node = assertStoredNode(id)
        const minZ = Math.min(
          ...Array.from(state.nodes.values(), (entry) => entry.zIndex),
        )
        const stored = replaceStoredNodeAndDispatch(node, {
          ...node,
          zIndex: minZ - 1,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    lockNode(id) {
      runCommand('lockNode', [id], () => {
        const node = assertStoredNode(id)
        const stored = replaceStoredNodeAndDispatch(node, {
          ...node,
          locked: true,
        })
        emit('node:updated', materializeNode(stored), materializeNode(node))
      })
    },
    unlockNode(id) {
      runCommand('unlockNode', [id], () => {
        const node = assertStoredNode(id)
        const stored = replaceStoredNodeAndDispatch(node, {
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
          .filter((node): node is StoredNode => Boolean(node))
          .sort((a, b) => a.zIndex - b.zIndex)
        const nextZIndexBefore = state.nextZIndex
        const created = duplicateForest(source, offset)
        for (const node of created) {
          state.nodes.set(node.id, node)
          dispatchAction({ type: 'NODE_CREATED', node })
          emit('node:created', materializeNode(node))
        }
        dispatchNextZIndexChange(nextZIndexBefore)
        notifyNodesChanged()
        setSelection(created.map((node) => node.id))
        return created.map((node) => materializeNode(node))
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
        const nextZIndexBefore = state.nextZIndex
        const created = duplicateForest(clipboard, offset)
        for (const node of created) {
          state.nodes.set(node.id, node)
          dispatchAction({ type: 'NODE_CREATED', node })
          emit('node:created', materializeNode(node))
        }
        dispatchNextZIndexChange(nextZIndexBefore)
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
          dispatchAction({ type: 'NODE_DELETED', node: prevNode })
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
          const node = assertStoredNode(id)
          if (node.locked) {
            return
          }
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
              const current = assertStoredNode(nodeId)
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
          bumpNodeToFront(id)
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    beginResize(id, handle, pointerId, screenPoint) {
      runCommand(
        'beginResize',
        [id, handle, pointerId, screenPoint],
        () => {
          const node = assertStoredNode(id)
          if (node.locked) {
            return
          }
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
          bumpNodeToFront(id)
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
          assertStoredNode(id)
          setSelection([id])
          setInteraction({ mode: 'editing-text', nodeId: id })
        },
        IGNORE_UNVALIDATED_COMMAND,
      )
    },
    commitTextEdit(id, text) {
      return runCommand('commitTextEdit', [id, text], () => {
        const node = assertStoredNode(id)
        let stored = node
        if (text !== undefined) {
          stored = replaceStoredNodeAndDispatch(node, { ...node, text })
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
              const node = assertStoredNode(nodeId)
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
              const current = assertStoredNode(nodeId)
              const preliminary = prelimBounds[nodeId]
              const origin = interaction.startNodePositions[nodeId]
              if (!preliminary || !origin) {
                continue
              }
              const before = { x: current.x, y: current.y }
              const stored = replaceStoredNodeWithoutNotify(current, {
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
              emit('node:moved', materializeNode(stored), {
                x: stored.x - origin.x,
                y: stored.y - origin.y,
              })
            }
            if (moveDeltas.length > 0) {
              dispatchAction({ type: 'NODES_MOVED', deltas: moveDeltas })
            }
            if (movedNodeCount > 0) {
              notifyNodesChanged()
            }
          },
          RECORD_COMMAND,
        )
        return
      }

      if (interaction.mode === 'resizing-node') {
        runCommand(
          'updatePointer',
          [pointerId, screenPoint, modifiers],
          () => {
            const node = assertStoredNode(interaction.nodeId)
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
              const stored = replaceStoredNodeAndDispatch(node, {
                ...node,
                ...nextBounds,
              })
              emitNodeResize(node, stored)
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
                const stored = replaceStoredNodeAndDispatch(node, {
                  ...node,
                  ...gridSnapped,
                })
                emitNodeResize(node, stored)
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
                const stored = replaceStoredNodeAndDispatch(node, {
                  ...node,
                  ...snapResult.bounds,
                })
                emitNodeResize(node, stored)
              }
            }
          },
          RECORD_COMMAND,
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
            reparentAfterDrag(previous.nodeIds)
            reparentNodesCapturedByMovedGroups(previous.nodeIds)
          }
          if (previous.mode === 'resizing-node') {
            reparentNodesCapturedByGroups([previous.nodeId], [previous.nodeId])
          }
          setInteraction({ mode: 'idle' })
        },
        IGNORE_COMMAND,
      )
    },
    getUniformTranslationTargets(seedIds) {
      return collectUniformTranslationTargets(
        seedIds,
        state.nodes as Map<NodeId, BoardNode>,
      )
    },
    syncGroupZOrder(groupId) {
      runCommand('syncGroupZOrder', [groupId], () => {
        assertStoredNode(groupId)
        restackGroupDescendantsAbove(groupId)
      })
    },
    exportJSON() {
      const featureDocuments = Array.from(
        featurePersistence.values(),
        (entry) => entry.hooks.exportDocument?.(entry.context) ?? {},
      )
      return JSON.stringify(
        toPersistedDocument(getSnapshot(), featureDocuments),
      )
    },
    importJSON(json, mode = 'replace') {
      runCommand(
        'importJSON',
        [mode],
        () => {
          const document = normalizeDocumentForImport(JSON.parse(json))
          assertCanRestoreDocument(document)
          const snapshot = documentToSnapshot(document)
          const idMap = restoreSnapshot(snapshot, mode)
          restoreFeatureDocuments(document, mode, idMap)
        },
        IGNORE_COMMAND,
      )
    },
  }

  notifyNodesChanged()

  for (const feature of options.extensions ?? []) {
    assertInternalBoardFeature(feature)
    installFeature(feature)
  }

  if (initialDocument) {
    assertCanRestoreDocument(initialDocument)
    restoreFeatureDocuments(initialDocument, 'replace')
  }

  validate('createBoardEngine')
  emit('ready')

  return engine
}
