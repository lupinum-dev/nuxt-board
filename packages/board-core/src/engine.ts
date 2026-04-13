import {
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
  zoomCameraAtScreenPoint
} from './math'
import {
  collectSubtreeIds,
  collectUniformTranslationTargets,
  expandGroupDragSeeds,
  findContainingGroup,
  getBoundsFromNode,
  sortIdsByZIndex
} from './hierarchy'
import { cloneInteraction, validateState } from './invariants'
import { applyResizeDelta, applyResizeDeltaLocked, snapResizedBounds, snapResizedBoundsLocked } from './resize'
import { collectOtherNodeEdges, collectOtherNodeEdgesExcluding, snapBoundsToEdges, snapPositionToEdges } from './snap'
import { createBatchController, createSubscribable } from './subscribable'
import type {
  BoardSnapshot,
  BoardState,
  Bounds,
  Camera,
  BoardEngine,
  BoardEngineExtensions,
  BoardEngineOptions,
  BoardEventMap,
  BoardNode,
  BoardPlugin,
  BoardPluginContext,
  CommandMiddleware,
  GridSettings,
  InteractionState,
  InvariantMode,
  NodeConstraints,
  NodeData,
  NodeId,
  NodeInput,
  NodePatch,
  NodeTypeRegistry,
  Point,
  ResolvedNode,
  ResizeHandle,
  SnapGuide,
  Subscribable,
  TraceEntry,
  ZoomSettings
} from './types'

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, z: 1 }
const DEFAULT_ZOOM: ZoomSettings = { min: 0.1, max: 8 }
const DEFAULT_GRID: GridSettings = { size: 10, majorEvery: 5, snap: true, edgeSnap: true, edgeSnapThreshold: 8, pattern: 'line' }
const DEFAULT_NODE_CONSTRAINTS: NodeConstraints = {
  minWidth: 50,
  minHeight: 50,
  defaultWidth: 240,
  defaultHeight: 160
}
const DEFAULT_VIEWPORT_SIZE: Point = { x: 1280, y: 720 }

interface StoredNode<TType extends string = string, TData extends NodeData = NodeData> extends BoardNode<TType, TData> {
  readonly _version: number
  readonly _geometryVersion: number
  readonly _dataVersion: number
}

interface MutableBoardState<R extends NodeTypeRegistry> {
  camera: Camera
  nodes: Map<NodeId, StoredNode>
  selection: Set<NodeId>
  interaction: InteractionState
  snapGuides: SnapGuide[]
  nextZIndex: number
}

type ListenerMap<R extends NodeTypeRegistry> = Map<keyof BoardEventMap<R>, Set<(...args: unknown[]) => void>>

function cloneData<T>(value: T): T {
  return structuredClone(value)
}

function freezeClone<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      freezeClone(entry)
    }
    return Object.freeze(value)
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeClone(child)
    }
    return Object.freeze(value)
  }
  return value
}

function createNodeId(): NodeId {
  return crypto.randomUUID() as NodeId
}

export function createBoardEngine<R extends NodeTypeRegistry = NodeTypeRegistry>(
  options: BoardEngineOptions<R> = {}
): BoardEngine<R> {
  const camera: Camera = { ...DEFAULT_CAMERA, ...options.camera }
  const zoom: ZoomSettings = { ...DEFAULT_ZOOM, ...options.zoom }
  const grid: GridSettings = { ...DEFAULT_GRID, ...options.grid }
  const nodeConstraints: NodeConstraints = { ...DEFAULT_NODE_CONSTRAINTS, ...options.nodes }
  const invariantMode: InvariantMode = options.invariants ?? 'strict'
  const diagnosticsEnabled = options.diagnostics !== false
  const traceLimit =
    typeof options.diagnostics === 'object' && options.diagnostics.traceLimit
      ? options.diagnostics.traceLimit
      : 500

  const listeners: ListenerMap<R> = new Map()
  const trace: TraceEntry[] = []
  const pluginCleanups = new Map<string, () => void>()
  const middlewares: CommandMiddleware[] = []
  const clipboard: StoredNode[] = []
  const ext = {} as BoardEngineExtensions<R>
  let viewportSize = { ...DEFAULT_VIEWPORT_SIZE }
  let animationToken = 0

  const state: MutableBoardState<R> = {
    camera,
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 1
  }

  for (const node of options.initialNodes ?? []) {
    const normalized = normalizeExistingNode(node)
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }

  const batchCtrl = createBatchController()
  const $camera = createSubscribable<Camera>(freezeClone({ ...state.camera }), batchCtrl)
  const $nodes = createSubscribable<ReadonlyMap<NodeId, ResolvedNode<R>>>(new Map(), batchCtrl)
  const $selection = createSubscribable<ReadonlySet<NodeId>>(new Set(state.selection), batchCtrl)
  const $interaction = createSubscribable<InteractionState>(cloneInteraction(state.interaction), batchCtrl)
  const $snapGuides = createSubscribable<readonly SnapGuide[]>(state.snapGuides.map((guide) => freezeClone({ ...guide })), batchCtrl)

  let cachedPublicNodeMap: ReadonlyMap<NodeId, ResolvedNode<R>> | null = null
  let validationPending = false
  let transactionDepth = 0
  let transactionStartedAt = 0

  function emit<K extends keyof BoardEventMap<R>>(event: K, ...args: Parameters<BoardEventMap<R>[K]>): void {
    if (diagnosticsEnabled) {
      trace.push({ event: String(event), timestamp: Date.now(), args })
      if (trace.length > traceLimit) {
        trace.shift()
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      try {
        ;(handler as (...payload: Parameters<BoardEventMap<R>[K]>) => void)(...args)
      } catch (error) {
        console.error(`[board] handler for "${String(event)}" threw:`, error)
      }
    }
  }

  function on<K extends keyof BoardEventMap<R>>(event: K, handler: BoardEventMap<R>[K]) {
    const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
    set.add(handler as (...args: unknown[]) => void)
    listeners.set(event, set)
    return () => off(event, handler)
  }

  function once<K extends keyof BoardEventMap<R>>(event: K, handler: BoardEventMap<R>[K]) {
    const unsubscribe = on(event, ((...args: unknown[]) => {
      unsubscribe()
      ;(handler as (...payload: unknown[]) => void)(...args)
    }) as BoardEventMap<R>[K])
    return unsubscribe
  }

  function off<K extends keyof BoardEventMap<R>>(event: K, handler: BoardEventMap<R>[K]): void {
    listeners.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  function getGridSettings(): GridSettings {
    return freezeClone({ ...grid })
  }

  function getViewportSize(): Point {
    return freezeClone({ ...viewportSize })
  }

  function materializeNode<T extends keyof R = keyof R>(node: StoredNode): ResolvedNode<R, T> {
    return freezeClone({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      data: cloneData(node.data),
      zIndex: node.zIndex,
      locked: node.locked,
      visible: node.visible,
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {})
    }) as ResolvedNode<R, T>
  }

  function getPublicNodeMap(): ReadonlyMap<NodeId, ResolvedNode<R>> {
    if (!cachedPublicNodeMap) {
      cachedPublicNodeMap = new Map(
        Array.from(state.nodes.values(), (node) => [node.id, materializeNode(node)] as const)
      )
    }
    return cachedPublicNodeMap
  }

  function notifyNodesChanged(): void {
    cachedPublicNodeMap = null
    $nodes.set(new Map(getPublicNodeMap()))
  }

  function notifySelectionChanged(): void {
    $selection.set(new Set(state.selection))
  }

  function notifyInteractionChanged(): void {
    $interaction.set(cloneInteraction(state.interaction))
  }

  function notifySnapGuidesChanged(): void {
    $snapGuides.set(state.snapGuides.map((guide) => freezeClone({ ...guide })))
  }

  function flushBatchNotifications(): void {
    const pending = [...batchCtrl.pending]
    batchCtrl.pending.clear()
    for (const flush of pending) {
      flush()
    }
  }

  function beginTransaction(): void {
    if (transactionDepth === 0) {
      transactionStartedAt = performance.now()
      batchCtrl.depth += 1
      emit('command:before', 'batch', [])
    }
    transactionDepth += 1
  }

  function endTransaction(): void {
    transactionDepth -= 1
    if (transactionDepth !== 0) {
      return
    }
    if (validationPending) {
      validate('batch')
      validationPending = false
    }
    batchCtrl.depth -= 1
    flushBatchNotifications()
    emit('command:after', 'batch', [], performance.now() - transactionStartedAt)
  }

  function getSnapshot(): BoardSnapshot<R> {
    return freezeClone({
      camera: { ...state.camera },
      grid: { ...grid },
      nodes: Array.from(getPublicNodeMap().values()).sort((a, b) => a.zIndex - b.zIndex),
      selection: Array.from(state.selection.values()),
      interaction: cloneInteraction(state.interaction),
      snapGuides: state.snapGuides.map((guide) => ({ ...guide })),
      nextZIndex: state.nextZIndex
    })
  }

  function getState(): BoardState<R> {
    return {
      camera: freezeClone({ ...state.camera }),
      nodes: new Map(getPublicNodeMap()),
      selection: new Set(state.selection),
      interaction: cloneInteraction(state.interaction),
      snapGuides: state.snapGuides.map((guide) => freezeClone({ ...guide })),
      nextZIndex: state.nextZIndex
    }
  }

  function runMiddlewareChain(name: string, args: unknown[]): boolean {
    if (middlewares.length === 0) return true
    let proceeded = false
    let i = 0
    function step(): void {
      const middleware = middlewares[i++]
      if (middleware) {
        middleware(name, args, step)
      }
      else {
        proceeded = true
      }
    }
    step()
    return proceeded
  }

  function runCommand<T>(name: string, args: unknown[], fn: () => T, skipValidation = false): T {
    // Middleware runs first — before any events are emitted.
    // If the chain doesn't call next(), the command is silently cancelled.
    if (!runMiddlewareChain(name, args)) {
      emit('command:blocked', name, args)
      return undefined as unknown as T
    }
    const started = performance.now()
    const inTransaction = transactionDepth > 0
    if (!inTransaction) {
      emit('command:before', name, args)
    }
    const result = fn()
    if (!skipValidation) {
      if (inTransaction) {
        validationPending = true
      } else {
        validate(name)
      }
    }
    if (!inTransaction) {
      emit('command:after', name, args, performance.now() - started)
    }
    return result
  }

  async function runAsyncCommand<T>(name: string, args: unknown[], fn: () => Promise<T>, skipValidation = false): Promise<T> {
    const started = performance.now()
    emit('command:before', name, args)
    try {
      const result = await fn()
      if (!skipValidation) {
        validate(name)
      }
      emit('command:after', name, args, performance.now() - started)
      return result
    } catch (error) {
      if (error instanceof AnimationCancelled) {
        return undefined as T
      }
      throw error
    }
  }

  function validate(context: string): void {
    if (invariantMode === 'off') {
      return
    }
    const failures = validateState(getState(), grid, context)
    for (const failure of failures) {
      emit('invariant:failed', failure)
    }
    if (failures.length > 0 && invariantMode === 'strict') {
      throw new Error(`Board invariant failed in ${context}: ${failures[0]?.message}`)
    }
  }

  function setCamera(next: Camera): void {
    const prev = { ...state.camera }
    if (prev.x === next.x && prev.y === next.y && prev.z === next.z) {
      return
    }
    state.camera = next
    $camera.set(freezeClone({ ...next }))
    emit('camera:change', freezeClone({ ...next }), freezeClone(prev))
  }

  function setSelection(nextSelection: Iterable<NodeId>): void {
    const prev = Array.from(state.selection.values())
    const next = Array.from(nextSelection)
    if (sameArray(prev, next)) {
      return
    }
    state.selection = new Set(next)
    notifySelectionChanged()
    emit('selection:change', next, prev)
  }

  function setInteraction(next: InteractionState): void {
    const prev = state.interaction
    state.interaction = next
    notifyInteractionChanged()
    if (prev.mode === 'idle' && next.mode !== 'idle') {
      emit('interaction:start', cloneInteraction(next))
      return
    }
    if (prev.mode !== 'idle' && next.mode === 'idle') {
      emit('interaction:end', cloneInteraction(prev))
      return
    }
    if (prev.mode !== 'idle' && next.mode !== 'idle') {
      emit('interaction:update', cloneInteraction(next))
    }
  }

  function setSnapGuides(next: SnapGuide[]): void {
    state.snapGuides = next
    notifySnapGuidesChanged()
  }

  function assertStoredNode(id: NodeId): StoredNode {
    const node = state.nodes.get(id)
    if (!node) {
      throw new Error(`Node "${id}" does not exist.`)
    }
    return node
  }

  function normalizeExistingNode(node: ResolvedNode<R>): StoredNode {
    const parentId =
      typeof node.parentId === 'string' && node.parentId.length > 0 ? node.parentId : undefined
    return {
      ...node,
      data: cloneData(node.data),
      locked: Boolean(node.locked),
      visible: node.visible !== false,
      parentId,
      _version: 0,
      _geometryVersion: 0,
      _dataVersion: 0
    }
  }

  function defaultNodeData(type: string): NodeData {
    if (type === 'text') {
      return { content: '' }
    }
    if (type === 'group') {
      return { title: 'Untitled group', accent: '#0d9488' }
    }
    return {}
  }

  function normalizeNode<T extends keyof R = keyof R>(input: NodeInput<R, T>): StoredNode {
    const rawPoint = { x: input.x ?? 0, y: input.y ?? 0 }
    const snappedPoint = grid.snap ? snapPoint(rawPoint, grid.size) : rawPoint
    const width = grid.snap
      ? snapSize(input.width ?? nodeConstraints.defaultWidth, grid.size, nodeConstraints.minWidth)
      : input.width ?? nodeConstraints.defaultWidth
    const height = grid.snap
      ? snapSize(input.height ?? nodeConstraints.defaultHeight, grid.size, nodeConstraints.minHeight)
      : input.height ?? nodeConstraints.defaultHeight
    const type = (input.type ?? 'text') as keyof R & string
    const parentId =
      typeof input.parentId === 'string' && input.parentId.length > 0 ? input.parentId : undefined

    return {
      id: input.id ?? createNodeId(),
      type,
      x: snappedPoint.x,
      y: snappedPoint.y,
      width,
      height,
      data: cloneData((input.data ?? defaultNodeData(type)) as R[keyof R]),
      zIndex: state.nextZIndex++,
      locked: Boolean(input.locked),
      visible: input.visible !== false,
      parentId,
      _version: 0,
      _geometryVersion: 0,
      _dataVersion: 0
    }
  }

  function applyNodePatch<T extends keyof R = keyof R>(node: StoredNode, patch: NodePatch<R, T>): StoredNode {
    const nextBase = {
      ...node,
      ...patch,
      parentId: 'parentId' in patch ? patch.parentId : node.parentId,
      data: patch.data === undefined ? node.data : cloneData(patch.data)
    }
    const x = grid.snap ? snapValue(nextBase.x, grid.size) : nextBase.x
    const y = grid.snap ? snapValue(nextBase.y, grid.size) : nextBase.y
    const width = grid.snap ? snapSize(nextBase.width, grid.size, nodeConstraints.minWidth) : nextBase.width
    const height = grid.snap ? snapSize(nextBase.height, grid.size, nodeConstraints.minHeight) : nextBase.height

    return {
      ...nextBase,
      x,
      y,
      width,
      height,
      _version: node._version,
      _geometryVersion: node._geometryVersion,
      _dataVersion: node._dataVersion
    }
  }

  function replaceStoredNode(node: StoredNode, next: StoredNode): StoredNode {
    const geometryChanged = node.x !== next.x || node.y !== next.y || node.width !== next.width || node.height !== next.height
    const dataChanged = node.data !== next.data
    const stored: StoredNode = {
      ...next,
      _version: node._version + 1,
      _geometryVersion: geometryChanged ? node._geometryVersion + 1 : node._geometryVersion,
      _dataVersion: dataChanged ? node._dataVersion + 1 : node._dataVersion
    }
    state.nodes.set(node.id, stored)
    notifyNodesChanged()
    return stored
  }

  function getPublicNode(id: NodeId): ResolvedNode<R> {
    return materializeNode(assertStoredNode(id))
  }

  function bumpNodeToFront(id: NodeId): void {
    const node = state.nodes.get(id)
    if (!node) {
      return
    }
    const next = replaceStoredNode(node, { ...node, zIndex: state.nextZIndex++ })
    emit('node:updated', materializeNode(next), materializeNode(node))
    restackGroupDescendantsAbove(id)
  }

  function getDirectChildren(parentId: NodeId): StoredNode[] {
    return Array.from(state.nodes.values()).filter((node) => node.parentId === parentId)
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

  function fixSubtreeZOrderAfter(parent: StoredNode | null, nodeId: NodeId): void {
    const node = state.nodes.get(nodeId)
    if (!node) {
      return
    }
    let current = node
    if (parent && current.zIndex <= parent.zIndex) {
      current = replaceStoredNode(node, { ...node, zIndex: state.nextZIndex++ })
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
    const ordered = sortIdsByZIndex(movedIds, state.nodes as Map<NodeId, BoardNode>)
    for (const id of ordered) {
      const node = state.nodes.get(id)
      if (!node) {
        continue
      }
      const nextParent = findContainingGroup(node, state.nodes as Map<NodeId, BoardNode>)
      if (nextParent === node.parentId) {
        continue
      }
      const updated = replaceStoredNode(node, { ...node, parentId: nextParent })
      emit('node:updated', materializeNode(updated), materializeNode(node))
      fixSubtreeZOrderAfter(nextParent ? assertStoredNode(nextParent) : null, id)
    }
  }

  function getSelectionNodes(): StoredNode[] {
    return Array.from(state.selection.values())
      .map((id) => state.nodes.get(id))
      .filter((node): node is StoredNode => Boolean(node))
  }

  function getCopyClosureNodes(): StoredNode[] {
    const selected = getSelectionNodes()
    const ids = expandGroupDragSeeds(
      selected.map((node) => node.id),
      state.nodes as Map<NodeId, BoardNode>
    )
    return Array.from(ids)
      .map((id) => state.nodes.get(id))
      .filter((node): node is StoredNode => Boolean(node))
      .sort((a, b) => a.zIndex - b.zIndex)
  }

  function duplicateForest(nodes: StoredNode[], offset: Point): StoredNode[] {
    const sorted = [...nodes].sort((a, b) => a.zIndex - b.zIndex)
    const idMap = new Map<NodeId, NodeId>()
    for (const node of sorted) {
      idMap.set(node.id, createNodeId())
    }
    return sorted.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      data: cloneData(node.data),
      parentId: node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : undefined,
      x: grid.snap ? snapValue(node.x + offset.x, grid.size) : node.x + offset.x,
      y: grid.snap ? snapValue(node.y + offset.y, grid.size) : node.y + offset.y,
      zIndex: state.nextZIndex++,
      _version: 0,
      _geometryVersion: 0,
      _dataVersion: 0
    }))
  }

  function cleanupSelection(): void {
    setSelection(Array.from(state.selection.values()).filter((id) => state.nodes.has(id)))
  }

  function getAnimationFrameDriver() {
    const raf = globalThis.requestAnimationFrame?.bind(globalThis)
    const caf = globalThis.cancelAnimationFrame?.bind(globalThis)
    if (typeof raf === 'function' && typeof caf === 'function') {
      return { raf, caf }
    }
    return {
      raf: (cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(Date.now()), 16) as unknown as number,
      caf: (handle: number) => globalThis.clearTimeout(handle)
    }
  }

  class AnimationCancelled extends Error {
    constructor() {
      super('Animation cancelled')
      this.name = 'AnimationCancelled'
    }
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
      ? ids.map((id) => state.nodes.get(id)).filter((node): node is StoredNode => Boolean(node && node.visible))
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
        maxY: Math.max(acc.maxY, current.maxY)
      }
    }, getBoundsFromNode(source[0]!))

    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const zoomLevel = clamp(
      Math.min((viewportSize.x - padding * 2) / width, (viewportSize.y - padding * 2) / height),
      zoom.min,
      zoom.max
    )
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    }
    return {
      x: viewportSize.x / (2 * zoomLevel) - center.x,
      y: viewportSize.y / (2 * zoomLevel) - center.y,
      z: zoomLevel
    }
  }

  function restoreSnapshot(snapshot: BoardSnapshot<R>, mode: 'replace' | 'merge'): void {
    if (mode === 'replace') {
      state.nodes = new Map(snapshot.nodes.map((node) => [node.id, normalizeExistingNode(node)]))
      state.selection = new Set(snapshot.selection.filter((id) => state.nodes.has(id)))
      state.interaction = { mode: 'idle' }
      state.nextZIndex = snapshot.nextZIndex
      notifyNodesChanged()
      notifySelectionChanged()
      notifyInteractionChanged()
      setCamera({ ...snapshot.camera })
      grid.size = snapshot.grid.size
      grid.majorEvery = snapshot.grid.majorEvery
      grid.snap = snapshot.grid.snap
      grid.edgeSnap = snapshot.grid.edgeSnap ?? true
      grid.edgeSnapThreshold = snapshot.grid.edgeSnapThreshold ?? 8
      grid.pattern = snapshot.grid.pattern
      return
    }

    for (const rawNode of snapshot.nodes) {
      const node = normalizeExistingNode(rawNode)
      const id = state.nodes.has(node.id) ? createNodeId() : node.id
      state.nodes.set(id, { ...node, id, zIndex: state.nextZIndex++ })
    }
    notifyNodesChanged()
  }

  const engine: BoardPluginContext<R> = {
    ext,
    $camera,
    $nodes: $nodes as Subscribable<ReadonlyMap<NodeId, ResolvedNode<R>>>,
    $selection: $selection as Subscribable<ReadonlySet<NodeId>>,
    $interaction,
    $snapGuides,
    extend(key, value) {
      ;(ext as unknown as Record<string, unknown>)[key] = value as unknown
    },
    batch(fn) {
      beginTransaction()
      try {
        fn()
      } finally {
        endTransaction()
      }
    },
    getState,
    getSnapshot,
    getGridSettings,
    getViewportSize,
    updateGridSettings(patch) {
      return runCommand('updateGridSettings', [patch], () => {
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
        return getGridSettings()
      })
    },
    setViewportSize(size) {
      viewportSize = {
        x: Math.max(1, size.x),
        y: Math.max(1, size.y)
      }
    },
    emit,
    on,
    once,
    off,
    exportTrace() {
      return trace.slice()
    },
    use(plugin: BoardPlugin<R>) {
      if (pluginCleanups.has(plugin.name)) {
        return
      }
      const cleanup = plugin.install(engine)
      pluginCleanups.set(plugin.name, cleanup ?? (() => undefined))
    },
    addMiddleware(fn: CommandMiddleware) {
      middlewares.push(fn)
      return () => {
        const idx = middlewares.indexOf(fn)
        if (idx !== -1) middlewares.splice(idx, 1)
      }
    },
    runCommand<T>(name: string, args: unknown[], fn: () => T): T {
      return runCommand(name, args, fn)
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
        if (node.visible && node.zIndex > bestZ && pointInBounds(worldPoint, getBoundsFromNode(node))) {
          best = node
          bestZ = node.zIndex
        }
      }
      return best ? materializeNode(best) : null
    },
    getNodesInBounds(bounds) {
      return Array.from(state.nodes.values())
        .filter((node) => node.visible && boundsIntersect(getBoundsFromNode(node), bounds))
        .map((node) => materializeNode(node))
    },
    panBy(dx, dy) {
      runCommand('panBy', [dx, dy], () => {
        setCamera({
          x: state.camera.x - dx / state.camera.z,
          y: state.camera.y - dy / state.camera.z,
          z: state.camera.z
        })
      }, true)
    },
    panTo(worldPoint, animated = false) {
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z }
      return runAsyncCommand('panTo', [worldPoint, animated], async () => {
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      }, true)
    },
    zoomAt(screenPoint, delta) {
      runCommand('zoomAt', [screenPoint, delta], () => {
        setCamera(zoomCameraAtScreenPoint(screenPoint, delta, state.camera, zoom.min, zoom.max))
      }, true)
    },
    zoomTo(level, animated = false) {
      const clamped = clamp(level, zoom.min, zoom.max)
      const viewportCenter = { x: viewportSize.x / 2, y: viewportSize.y / 2 }
      const centerWorld = screenToWorld(viewportCenter, state.camera)
      const target = {
        x: viewportCenter.x / clamped - centerWorld.x,
        y: viewportCenter.y / clamped - centerWorld.y,
        z: clamped
      }
      return runAsyncCommand('zoomTo', [level, animated], async () => {
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      }, true)
    },
    zoomToFit(padding = 40, animated = false) {
      return runAsyncCommand('zoomToFit', [padding, animated], async () => {
        const target = computeFitCamera(null, padding)
        if (!target) {
          return
        }
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      }, true)
    },
    zoomToNodes(ids, padding = 40, animated = false) {
      return runAsyncCommand('zoomToNodes', [ids, padding, animated], async () => {
        const target = computeFitCamera(ids, padding)
        if (!target) {
          return
        }
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      }, true)
    },
    createNode<T extends keyof R = keyof R>(input: NodeInput<R, T>) {
      return runCommand('createNode', [input], () => {
        const node = normalizeNode(input)
        state.nodes.set(node.id, node)
        notifyNodesChanged()
        if (input.select !== false) {
          setSelection([node.id])
        }
        const publicNode = materializeNode(node) as ResolvedNode<R, T>
        emit('node:created', publicNode)
        return publicNode
      })
    },
    updateNode<T extends keyof R = keyof R>(id: NodeId, patch: NodePatch<R, T>) {
      return runCommand('updateNode', [id, patch], () => {
        const current = assertStoredNode(id)
        const next = applyNodePatch(current, patch)
        const stored = replaceStoredNode(current, next)
        const publicNode = materializeNode(stored) as ResolvedNode<R, T>
        emit('node:updated', publicNode, materializeNode(current) as ResolvedNode<R, T>)
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
        const targets = collectUniformTranslationTargets([id], state.nodes as Map<NodeId, BoardNode>)
        for (const targetId of targets) {
          const current = assertStoredNode(targetId)
          const next = {
            ...current,
            x: grid.snap ? snapValue(current.x + dx, grid.size) : current.x + dx,
            y: grid.snap ? snapValue(current.y + dy, grid.size) : current.y + dy
          }
          const stored = replaceStoredNode(current, next)
          const publicNode = materializeNode(stored)
          emit('node:moved', publicNode, { x: publicNode.x - current.x, y: publicNode.y - current.y })
          emit('node:updated', publicNode, materializeNode(current))
        }
        reparentAfterDrag(targets)
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
        const targets = collectUniformTranslationTargets(seeds, state.nodes as Map<NodeId, BoardNode>)
        for (const targetId of targets) {
          const current = assertStoredNode(targetId)
          const next = {
            ...current,
            x: grid.snap ? snapValue(current.x + dx, grid.size) : current.x + dx,
            y: grid.snap ? snapValue(current.y + dy, grid.size) : current.y + dy
          }
          const stored = replaceStoredNode(current, next)
          const publicNode = materializeNode(stored)
          emit('node:moved', publicNode, { x: publicNode.x - current.x, y: publicNode.y - current.y })
          emit('node:updated', publicNode, materializeNode(current))
        }
        reparentAfterDrag(targets)
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
          minHeight: nodeConstraints.minHeight
        })
        const nextBounds = grid.snap
          ? snapResizedBounds(raw, handle, grid.size, {
              minWidth: nodeConstraints.minWidth,
              minHeight: nodeConstraints.minHeight
            })
          : raw
        const stored = replaceStoredNode(node, { ...node, ...nextBounds })
        const publicNode = materializeNode(stored)
        emit('node:resized', publicNode, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        })
        emit('node:updated', publicNode, materializeNode(node))
        return publicNode
      })
    },
    bringToFront(id) {
      runCommand('bringToFront', [id], () => {
        const node = assertStoredNode(id)
        const stored = replaceStoredNode(node, { ...node, zIndex: state.nextZIndex++ })
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    sendToBack(id) {
      runCommand('sendToBack', [id], () => {
        const node = assertStoredNode(id)
        const minZ = Math.min(...Array.from(state.nodes.values(), (entry) => entry.zIndex))
        const stored = replaceStoredNode(node, { ...node, zIndex: minZ - 1 })
        emit('node:updated', materializeNode(stored), materializeNode(node))
        restackGroupDescendantsAbove(id)
      })
    },
    lockNode(id) {
      runCommand('lockNode', [id], () => {
        const node = assertStoredNode(id)
        const stored = replaceStoredNode(node, { ...node, locked: true })
        emit('node:updated', materializeNode(stored), materializeNode(node))
      })
    },
    unlockNode(id) {
      runCommand('unlockNode', [id], () => {
        const node = assertStoredNode(id)
        const stored = replaceStoredNode(node, { ...node, locked: false })
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
        const created = duplicateForest(source, offset)
        for (const node of created) {
          state.nodes.set(node.id, node)
          emit('node:created', materializeNode(node))
        }
        notifyNodesChanged()
        setSelection(created.map((node) => node.id))
        return created.map((node) => materializeNode(node))
      })
    },
    copySelected() {
      return runCommand('copySelected', [], () => {
        clipboard.length = 0
        for (const node of getCopyClosureNodes()) {
          clipboard.push({
            ...node,
            data: cloneData(node.data)
          })
        }
        return clipboard.map((node) => materializeNode(node))
      })
    },
    pasteClipboard(offset = { x: grid.size, y: grid.size }) {
      return runCommand('pasteClipboard', [offset], () => {
        const created = duplicateForest(clipboard, offset)
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
      runCommand('select', [ids, mode], () => {
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
      })
    },
    selectAll() {
      runCommand('selectAll', [], () => {
        setSelection(Array.from(state.nodes.values()).filter((node) => node.visible).map((node) => node.id))
      })
    },
    clearSelection() {
      runCommand('clearSelection', [], () => {
        setSelection([])
      })
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
      runCommand('beginPan', [pointerId, screenPoint], () => {
        setInteraction({ mode: 'panning', pointerId, lastScreenPoint: { ...screenPoint } })
      }, true)
    },
    beginNodeDrag(id, pointerId, screenPoint) {
      runCommand('beginNodeDrag', [id, pointerId, screenPoint], () => {
        const node = assertStoredNode(id)
        if (node.locked) {
          return
        }
        const initialSelection = state.selection.has(id)
          ? getSelectionNodes().filter((entry) => !entry.locked).map((entry) => entry.id)
          : [id]
        const nodeIds = collectUniformTranslationTargets(initialSelection, state.nodes as Map<NodeId, BoardNode>)
        if (!state.selection.has(id)) {
          setSelection([id])
        }
        const startNodePositions = Object.fromEntries(
          nodeIds.map((nodeId) => {
            const current = assertStoredNode(nodeId)
            return [nodeId, { x: current.x, y: current.y }]
          })
        ) as Record<NodeId, Point>
        setInteraction({
          mode: 'dragging-nodes',
          pointerId,
          nodeIds,
          startScreenPoint: { ...screenPoint },
          startNodePositions
        })
        bumpNodeToFront(id)
      }, true)
    },
    beginResize(id, handle, pointerId, screenPoint) {
      runCommand('beginResize', [id, handle, pointerId, screenPoint], () => {
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
            height: node.height
          },
          aspectRatio: node.width / node.height
        })
        bumpNodeToFront(id)
      }, true)
    },
    beginBoxSelect(pointerId, screenPoint) {
      runCommand('beginBoxSelect', [pointerId, screenPoint], () => {
        const worldPoint = engine.screenToWorld(screenPoint)
        setSelection([])
        setInteraction({
          mode: 'box-select',
          pointerId,
          startScreenPoint: { ...screenPoint },
          currentScreenPoint: { ...screenPoint },
          startWorldPoint: worldPoint,
          currentWorldPoint: worldPoint
        })
      }, true)
    },
    beginTextEdit(id) {
      runCommand('beginTextEdit', [id], () => {
        assertStoredNode(id)
        setSelection([id])
        setInteraction({ mode: 'editing-text', nodeId: id })
      }, true)
    },
    commitTextEdit(id, text) {
      return runCommand('commitTextEdit', [id, text], () => {
        const node = assertStoredNode(id)
        let stored = node
        if (text !== undefined) {
          const data = typeof node.data === 'object' && node.data !== null ? cloneData(node.data) : {}
          ;(data as Record<string, unknown>).content = text
          stored = replaceStoredNode(node, { ...node, data })
          emit('node:updated', materializeNode(stored), materializeNode(node))
        }
        setInteraction({ mode: 'idle' })
        return materializeNode(stored)
      })
    },
    updatePointer(pointerId, screenPoint, modifiers) {
      const interaction = state.interaction
      if (interaction.mode === 'idle' || interaction.mode === 'editing-text' || interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'panning') {
        runCommand('updatePointer', [pointerId, screenPoint], () => {
          const deltaX = screenPoint.x - interaction.lastScreenPoint.x
          const deltaY = screenPoint.y - interaction.lastScreenPoint.y
          setCamera({
            x: state.camera.x + deltaX / state.camera.z,
            y: state.camera.y + deltaY / state.camera.z,
            z: state.camera.z
          })
          setInteraction({
            ...interaction,
            lastScreenPoint: { ...screenPoint }
          })
        }, true)
        return
      }

      if (interaction.mode === 'dragging-nodes') {
        runCommand('updatePointer', [pointerId, screenPoint, modifiers], () => {
          const rawDeltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
          const rawDeltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
          const axisLocked = Boolean(modifiers?.shift)
          const deltaX = axisLocked && Math.abs(rawDeltaY) > Math.abs(rawDeltaX) ? 0 : rawDeltaX
          const deltaY = axisLocked && Math.abs(rawDeltaX) >= Math.abs(rawDeltaY) ? 0 : rawDeltaY
          const bypassSnapping = Boolean(modifiers?.space)
          const snapToGrid = grid.snap && !bypassSnapping
          const prelimBounds: Record<NodeId, { x: number; y: number; width: number; height: number }> = {}
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
            const x = snapToGrid ? snapValue(origin.x + deltaX, grid.size) : origin.x + deltaX
            const y = snapToGrid ? snapValue(origin.y + deltaY, grid.size) : origin.y + deltaY
            prelimBounds[nodeId] = { x, y, width: node.width, height: node.height }
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + node.width)
            maxY = Math.max(maxY, y + node.height)
          }

          const snapResult = (bypassSnapping || !grid.edgeSnap)
            ? { dx: 0, dy: 0, guides: [] as SnapGuide[] }
            : (() => {
                const excludeIds = new Set(interaction.nodeIds)
                const otherEdges = collectOtherNodeEdgesExcluding(state.nodes.values(), excludeIds)
                const groupBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
                return snapPositionToEdges(groupBounds, otherEdges, grid.edgeSnapThreshold / state.camera.z)
              })()
          setSnapGuides(snapResult.guides)

          for (const nodeId of interaction.nodeIds) {
            const current = assertStoredNode(nodeId)
            const preliminary = prelimBounds[nodeId]
            const origin = interaction.startNodePositions[nodeId]
            if (!preliminary || !origin) {
              continue
            }
            const stored = replaceStoredNode(current, {
              ...current,
              x: preliminary.x + snapResult.dx,
              y: preliminary.y + snapResult.dy
            })
            emit('node:moved', materializeNode(stored), {
              x: stored.x - origin.x,
              y: stored.y - origin.y
            })
          }
        }, true)
        return
      }

      if (interaction.mode === 'resizing-node') {
        runCommand('updatePointer', [pointerId, screenPoint, modifiers], () => {
          const node = assertStoredNode(interaction.nodeId)
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
          const constraints = { minWidth: nodeConstraints.minWidth, minHeight: nodeConstraints.minHeight }
          const locked = Boolean(modifiers?.shift)
          const bypassSnapping = Boolean(modifiers?.space)
          const raw = locked
            ? applyResizeDeltaLocked(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, constraints, interaction.aspectRatio)
            : applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, constraints)

          if (locked) {
            const nextBounds = !bypassSnapping && grid.snap
              ? snapResizedBoundsLocked(raw, interaction.startNodeBounds, interaction.handle, grid.size, constraints, interaction.aspectRatio)
              : raw
            setSnapGuides([])
            replaceStoredNode(node, { ...node, ...nextBounds })
          } else {
            const gridSnapped = !bypassSnapping && grid.snap ? snapResizedBounds(raw, interaction.handle, grid.size, constraints) : raw
            if (bypassSnapping || !grid.edgeSnap) {
              setSnapGuides([])
              replaceStoredNode(node, { ...node, ...gridSnapped })
            } else {
              const otherEdges = collectOtherNodeEdges(state.nodes.values(), interaction.nodeId)
              const snapResult = snapBoundsToEdges(gridSnapped, interaction.handle, otherEdges, grid.edgeSnapThreshold / state.camera.z)
              setSnapGuides(snapResult.guides)
              replaceStoredNode(node, { ...node, ...snapResult.bounds })
            }
          }
        }, true)
        return
      }

      runCommand('updatePointer', [pointerId, screenPoint], () => {
        const currentWorldPoint = engine.screenToWorld(screenPoint)
        const bounds = getBoundsFromPoints(interaction.startWorldPoint, currentWorldPoint)
        const matches = engine.getNodesInBounds(bounds).filter((node) => node.visible).map((node) => node.id)
        setSelection(matches)
        setInteraction({
          ...interaction,
          currentScreenPoint: { ...screenPoint },
          currentWorldPoint
        })
      }, true)
    },
    endInteraction(pointerId) {
      const interaction = state.interaction
      if (interaction.mode === 'idle') {
        return
      }
      if ('pointerId' in interaction && pointerId !== undefined && interaction.pointerId !== pointerId) {
        return
      }
      runCommand('endInteraction', [pointerId], () => {
        const previous = state.interaction
        setSnapGuides([])
        if (previous.mode === 'dragging-nodes') {
          reparentAfterDrag(previous.nodeIds)
        }
        setInteraction({ mode: 'idle' })
      })
    },
    getUniformTranslationTargets(seedIds) {
      return collectUniformTranslationTargets(seedIds, state.nodes as Map<NodeId, BoardNode>)
    },
    syncGroupZOrder(groupId) {
      runCommand('syncGroupZOrder', [groupId], () => {
        assertStoredNode(groupId)
        restackGroupDescendantsAbove(groupId)
      })
    },
    exportJSON() {
      return JSON.stringify(getSnapshot())
    },
    importJSON(json, mode = 'replace') {
      runCommand('importJSON', [mode], () => {
        const parsed = JSON.parse(json) as BoardSnapshot<R>
        if (!parsed || !Array.isArray(parsed.nodes)) {
          throw new Error('Invalid board document: missing nodes array.')
        }
        for (const node of parsed.nodes) {
          if (
            typeof node.id !== 'string' ||
            !Number.isFinite(node.x) ||
            !Number.isFinite(node.y) ||
            !Number.isFinite(node.width) ||
            !Number.isFinite(node.height)
          ) {
            throw new Error(`Invalid board document: node "${String(node.id ?? '?')}" has invalid geometry.`)
          }
        }
        restoreSnapshot(parsed, mode)
      })
    }
  }

  notifyNodesChanged()

  for (const plugin of options.plugins ?? []) {
    engine.use(plugin)
  }

  validate('createBoardEngine')
  emit('ready')

  return engine as BoardEngine<R>
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}
