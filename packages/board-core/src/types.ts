/**
 * A nominal type helper used to distinguish identifiers that are both strings at runtime.
 */
export type Brand<T, K extends string> = T & { readonly __brand: K }

/** Unique identifier for a board node. */
export type NodeId = Brand<string, 'NodeId'>
/** Unique identifier for a connection edge. */
export type EdgeId = Brand<string, 'EdgeId'>

/** Cast a string into a branded node id. Prefer this in tests and fixtures. */
export const asNodeId = (value: string): NodeId => value as NodeId
/** Cast a string into a branded edge id. Prefer this in tests and fixtures. */
export const asEdgeId = (value: string): EdgeId => value as EdgeId

/** Axis used by snapping guides and edge-alignment calculations. */
export type SnapAxis = 'x' | 'y'

/** Visual guide emitted while a drag or resize operation snaps against nearby edges. */
export interface SnapGuide {
  axis: SnapAxis
  position: number
  from: number
  to: number
}

/** A 2D coordinate in world or screen space depending on call site. */
export interface Point {
  x: number
  y: number
}

/** Axis-aligned rectangle represented by its minimum and maximum corners. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** View transform for the board surface. */
export interface Camera {
  x: number
  y: number
  z: number
}

/** Zoom limits enforced by the engine camera commands. */
export interface ZoomSettings {
  min: number
  max: number
}

/** Visual style used by the board grid renderer. */
export type GridPattern = 'dot' | 'line' | 'cross' | 'none'

/** Persistent grid configuration stored with the board snapshot. */
export interface GridSettings {
  size: number
  majorEvery: number
  snap: boolean
  edgeSnap: boolean
  edgeSnapThreshold: number
  pattern: GridPattern
}

/** Default dimensions used when callers omit node sizing data. */
export interface NodeConstraints {
  minWidth: number
  minHeight: number
  defaultWidth: number
  defaultHeight: number
}

/** Arbitrary payload carried by a board node. */
export type NodeData = Record<string, unknown>
/** Registry mapping node type names to their payload shapes. */
export type NodeTypeRegistry = Record<string, NodeData>

/** Public immutable node shape returned by snapshots, selectors, and commands. */
export interface BoardNode<
  TType extends string = string,
  TData extends NodeData = NodeData,
> {
  readonly id: NodeId
  readonly type: TType
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly data: TData
  readonly zIndex: number
  readonly locked: boolean
  readonly visible: boolean
  readonly parentId?: NodeId
}

/** Resolve a typed node from a registry by node type key. */
export type ResolvedNode<
  R extends NodeTypeRegistry = NodeTypeRegistry,
  T extends keyof R = keyof R,
> = T extends keyof R ? BoardNode<T & string, R[T]> : never

/** Input accepted by `createNode`, with sensible defaults for omitted fields. */
export interface NodeInput<
  R extends NodeTypeRegistry = NodeTypeRegistry,
  T extends keyof R = keyof R,
> {
  id?: NodeId
  type?: T & string
  x?: number
  y?: number
  width?: number
  height?: number
  data?: R[T]
  locked?: boolean
  visible?: boolean
  parentId?: NodeId
  select?: boolean
}

/** Partial update payload accepted by `updateNode`. */
export type NodePatch<
  R extends NodeTypeRegistry = NodeTypeRegistry,
  T extends keyof R = keyof R,
> = Partial<
  Pick<
    ResolvedNode<R, T>,
    'x' | 'y' | 'width' | 'height' | 'data' | 'locked' | 'visible' | 'parentId'
  >
>

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export type SelectionMode = 'replace' | 'append' | 'toggle'

/** High-level interaction state for the active pointer or keyboard gesture. */
export type InteractionMode =
  | 'idle'
  | 'panning'
  | 'dragging-nodes'
  | 'resizing-node'
  | 'box-select'
  | 'editing-text'

export interface IdleInteractionState {
  mode: 'idle'
}

export interface PanInteractionState {
  mode: 'panning'
  pointerId: number
  lastScreenPoint: Point
}

export interface DragInteractionState {
  mode: 'dragging-nodes'
  pointerId: number
  nodeIds: NodeId[]
  startScreenPoint: Point
  startNodePositions: Record<NodeId, Point>
}

export interface ResizeInteractionState {
  mode: 'resizing-node'
  pointerId: number
  nodeId: NodeId
  handle: ResizeHandle
  startScreenPoint: Point
  startNodeBounds: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>
  aspectRatio: number
}

export interface BoxSelectInteractionState {
  mode: 'box-select'
  pointerId: number
  startScreenPoint: Point
  currentScreenPoint: Point
  startWorldPoint: Point
  currentWorldPoint: Point
}

export interface EditingInteractionState {
  mode: 'editing-text'
  nodeId: NodeId
}

export type InteractionState =
  | IdleInteractionState
  | PanInteractionState
  | DragInteractionState
  | ResizeInteractionState
  | BoxSelectInteractionState
  | EditingInteractionState

/** Internal immutable engine state exposed through `getState()`. */
export interface BoardState<R extends NodeTypeRegistry = NodeTypeRegistry> {
  readonly camera: Camera
  readonly nodes: ReadonlyMap<NodeId, ResolvedNode<R>>
  readonly selection: ReadonlySet<NodeId>
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
  readonly nextZIndex: number
}

/** Serializable board snapshot used by import, export, and tests. */
export interface BoardSnapshot<R extends NodeTypeRegistry = NodeTypeRegistry> {
  readonly camera: Camera
  readonly grid: GridSettings
  readonly nodes: readonly ResolvedNode<R>[]
  readonly selection: readonly NodeId[]
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
  readonly nextZIndex: number
}

/** Invariant handling strategy for development and tests. */
export type InvariantMode = 'strict' | 'warn' | 'off'

export interface BoardEngineExtensions<
  R extends NodeTypeRegistry = NodeTypeRegistry,
> {}

/** Engine factory options shared by all commands, plugins, and renderers. */
export interface BoardEngineOptions<
  R extends NodeTypeRegistry = NodeTypeRegistry,
> {
  camera?: Partial<Camera>
  zoom?: Partial<ZoomSettings>
  grid?: Partial<GridSettings>
  nodes?: Partial<NodeConstraints>
  plugins?: BoardPlugin<R>[]
  diagnostics?: boolean | { traceLimit?: number }
  invariants?: InvariantMode
  initialNodes?: ReadonlyArray<ResolvedNode<R>>
}

/** Structured invariant violation emitted when validation fails. */
export interface InvariantFailure<
  R extends NodeTypeRegistry = NodeTypeRegistry,
> {
  name: string
  message: string
  snapshot: BoardSnapshot<R>
  context: string
}

/** Trace row recorded when diagnostics are enabled. */
export interface TraceEntry {
  event: string
  timestamp: number
  args: unknown[]
}

/** Event contract emitted by the board engine. Plugins extend this interface via module augmentation. */
export interface BoardEventMap<R extends NodeTypeRegistry = NodeTypeRegistry> {
  ready: () => void
  destroy: () => void
  'camera:change': (camera: Camera, prev: Camera) => void
  'viewport:change': (size: Point, prev: Point) => void
  'node:created': (node: ResolvedNode<R>) => void
  'node:updated': (node: ResolvedNode<R>, prev: ResolvedNode<R>) => void
  'node:deleted': (id: NodeId, prev: ResolvedNode<R>) => void
  'node:moved': (node: ResolvedNode<R>, delta: Point) => void
  'node:resized': (
    node: ResolvedNode<R>,
    prev: Pick<ResolvedNode<R>, 'x' | 'y' | 'width' | 'height'>,
  ) => void
  'selection:change': (selected: NodeId[], prev: NodeId[]) => void
  'interaction:start': (state: InteractionState) => void
  'interaction:update': (state: InteractionState) => void
  'interaction:end': (state: InteractionState) => void
  'command:before': (name: string, args: unknown[]) => void
  'command:after': (name: string, args: unknown[], duration: number) => void
  'command:blocked': (name: string, args: unknown[]) => void
  'invariant:failed': (failure: InvariantFailure<R>) => void
}

export type PluginCleanup = () => void
export type Unsubscribe = () => void

/**
 * A middleware function that intercepts engine commands before they execute.
 * Call `next()` to allow the command to proceed; omit it to cancel.
 *
 * @example
 * engine.addMiddleware((name, args, next) => {
 *   if (name === 'moveNode') return  // block all moves
 *   next()
 * })
 */
export type CommandMiddleware = (
  name: string,
  args: unknown[],
  next: () => void,
) => void

/** Minimal observable contract used by the engine and framework adapters. */
export interface Subscribable<T> {
  get(): T
  subscribe(callback: (value: T, prev: T) => void): Unsubscribe
}

/**
 * Public board engine interface.
 *
 * Commands mutate persistent board state, subscribables expose reactive state,
 * and events let plugins or host applications observe lifecycle changes.
 */
export interface BoardEngine<R extends NodeTypeRegistry = NodeTypeRegistry> {
  readonly ext: BoardEngineExtensions<R>
  readonly $camera: Subscribable<Camera>
  readonly $nodes: Subscribable<ReadonlyMap<NodeId, ResolvedNode<R>>>
  readonly $selection: Subscribable<ReadonlySet<NodeId>>
  readonly $interaction: Subscribable<InteractionState>
  readonly $snapGuides: Subscribable<readonly SnapGuide[]>
  batch(fn: () => void): void
  getState(): BoardState<R>
  getSnapshot(): BoardSnapshot<R>
  getGridSettings(): GridSettings
  getViewportSize(): Point
  updateGridSettings(patch: Partial<GridSettings>): GridSettings
  setViewportSize(size: Point): void
  on<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): Unsubscribe
  once<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): Unsubscribe
  off<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): void
  exportTrace(): TraceEntry[]
  use(plugin: BoardPlugin<R>): void
  /**
   * Register a middleware that intercepts every command.
   * Middleware runs synchronously before the command body.
   * Call `next()` to allow the command to proceed; omit it to cancel silently.
   * Returns an unsubscribe function that removes the middleware.
   */
  addMiddleware(fn: CommandMiddleware): Unsubscribe
  screenToWorld(point: Point): Point
  worldToScreen(point: Point): Point
  getVisibleBounds(width: number, height: number): Bounds
  getNode(id: NodeId): ResolvedNode<R>
  findNode(id: NodeId): ResolvedNode<R> | null
  hasNode(id: NodeId): boolean
  getNodeAt(worldPoint: Point): ResolvedNode<R> | null
  getNodesInBounds(bounds: Bounds): ResolvedNode<R>[]
  panBy(dx: number, dy: number): void
  panTo(worldPoint: Point, animated?: boolean): Promise<void>
  zoomAt(screenPoint: Point, delta: number): void
  zoomTo(level: number, animated?: boolean): Promise<void>
  zoomToFit(padding?: number, animated?: boolean): Promise<void>
  zoomToNodes(
    ids: NodeId[],
    padding?: number,
    animated?: boolean,
  ): Promise<void>
  createNode<T extends keyof R = keyof R>(
    input: NodeInput<R, T>,
  ): ResolvedNode<R, T>
  updateNode<T extends keyof R = keyof R>(
    id: NodeId,
    patch: NodePatch<R, T>,
  ): ResolvedNode<R, T>
  deleteNode(id: NodeId): void
  moveNode(id: NodeId, dx: number, dy: number): ResolvedNode<R>
  translateSelectedNodes(dx: number, dy: number): void
  resizeNode(
    id: NodeId,
    handle: ResizeHandle,
    dx: number,
    dy: number,
  ): ResolvedNode<R>
  bringToFront(id: NodeId): void
  sendToBack(id: NodeId): void
  lockNode(id: NodeId): void
  unlockNode(id: NodeId): void
  duplicateNodes(ids: NodeId[], offset?: Point): ResolvedNode<R>[]
  copySelected(): ResolvedNode<R>[]
  pasteClipboard(offset?: Point): ResolvedNode<R>[]
  select(ids: NodeId | NodeId[], mode?: SelectionMode): void
  selectAll(): void
  clearSelection(): void
  deleteSelected(): void
  getSelection(): NodeId[]
  beginPan(pointerId: number, screenPoint: Point): void
  beginNodeDrag(id: NodeId, pointerId: number, screenPoint: Point): void
  beginResize(
    id: NodeId,
    handle: ResizeHandle,
    pointerId: number,
    screenPoint: Point,
  ): void
  beginBoxSelect(pointerId: number, screenPoint: Point): void
  beginTextEdit(id: NodeId): void
  commitTextEdit(id: NodeId, text?: string): ResolvedNode<R>
  updatePointer(
    pointerId: number,
    screenPoint: Point,
    modifiers?: { shift?: boolean; space?: boolean },
  ): void
  endInteraction(pointerId?: number): void
  getUniformTranslationTargets(seedIds: NodeId[]): NodeId[]
  syncGroupZOrder(groupId: NodeId): void
  exportJSON(): string
  importJSON(json: string, mode?: 'replace' | 'merge'): void
  /**
   * Subscribe to actions dispatched by commands.
   * Used by plugins (history, connections) to react to state mutations
   * without polling individual events.
   */
  onAction(
    listener: (action: import('./state/actions').Action) => void,
  ): Unsubscribe
  /**
   * Apply an action directly to engine state without running middleware or
   * command lifecycle events. Used by the history plugin to replay inverse
   * actions during undo/redo.
   */
  replay(action: import('./state/actions').Action): void
  /**
   * Compute the inverse of an action. Used by the history plugin.
   * Plugin-tunneled actions are inverted via the registering plugin's
   * `slice.invert` if present; otherwise an error is thrown.
   */
  invertAction(
    action: import('./state/actions').Action,
  ): import('./state/actions').Action
}

/**
 * Internal plugin-facing engine surface.
 *
 * Plugins receive the full public engine plus imperative hooks for extending
 * the engine surface, emitting events, and dispatching actions.
 */
export interface BoardPluginContext<
  R extends NodeTypeRegistry = NodeTypeRegistry,
> extends BoardEngine<R> {
  emit<K extends keyof BoardEventMap<R>>(
    event: K,
    ...args: Parameters<BoardEventMap<R>[K]>
  ): void
  extend<K extends keyof BoardEngineExtensions<R> & string>(
    key: K,
    value: BoardEngineExtensions<R>[K],
  ): void
  /**
   * Execute a named command through the full engine pipeline:
   * middleware chain → command:before → fn() → invariant validation → command:after.
   * Use this in plugins so that edge/connection operations appear in traces,
   * are interceptable by middleware, and are captured by the history plugin.
   */
  runCommand<T>(name: string, args: unknown[], fn: () => T): T
  /**
   * Dispatch an action. Called by command implementations to record state mutations
   * and notify subscribers (history, plugin reducers).
   */
  dispatch(action: import('./state/actions').Action): void
  /**
   * Read the current slice state for this plugin, as last produced by its reducer.
   */
  getPluginState<S>(): S
}

/** Reducer-backed persistent state owned by a plugin. */
export interface BoardPluginSlice {
  initial: unknown
  reducer: (state: never, action: import('./state/actions').Action) => unknown
  /**
   * Optionally invert a plugin-tunneled action so that history can replay its inverse.
   * Receives the inner action body (i.e. `(action as { type: 'PLUGIN' }).action`).
   * Must return an inner action shape suitable for re-dispatching as a PLUGIN action.
   */
  invert?: (innerAction: never) => unknown
}

/** Plugin contract used to extend the engine with state, commands, and side effects. */
export interface BoardPlugin<R extends NodeTypeRegistry = NodeTypeRegistry> {
  name: string
  slice?: BoardPluginSlice
  install(
    engine: BoardPluginContext<R>,
    options?: Record<string, unknown>,
  ): void | PluginCleanup
}
