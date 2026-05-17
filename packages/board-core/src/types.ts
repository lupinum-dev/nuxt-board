/**
 * A nominal type helper used to distinguish identifiers that are both strings at runtime.
 */
type Brand<T, K extends string> = T & { readonly __brand: K }

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

/** JSON Canvas 1.0 node type. */
export type JsonCanvasNodeType = 'text' | 'file' | 'link' | 'group'

/** JSON Canvas side name used by edges. */
export type JsonCanvasSide = 'top' | 'right' | 'bottom' | 'left'

/** JSON Canvas endpoint marker. */
export type JsonCanvasEdgeEnd = 'none' | 'arrow'

/** JSON Canvas group background rendering style. */
export type JsonCanvasBackgroundStyle = 'cover' | 'ratio' | 'repeat'

/** Obsidian-compatible color preset stored on nodes and resolved by renderers. */
export type BoardColorPreset = '1' | '2' | '3' | '4' | '5' | '6'
/** JSON Canvas color value: a preset id or a concrete hex color. */
export type CanvasColor = BoardColorPreset | `#${string}`

interface JsonCanvasNodeBase<TType extends JsonCanvasNodeType> {
  readonly id: NodeId
  readonly type: TType
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color?: CanvasColor
}

export interface JsonCanvasTextNode extends JsonCanvasNodeBase<'text'> {
  readonly text: string
}

export interface JsonCanvasFileNode extends JsonCanvasNodeBase<'file'> {
  readonly file: string
  readonly subpath?: string
}

export interface JsonCanvasLinkNode extends JsonCanvasNodeBase<'link'> {
  readonly url: string
}

export interface JsonCanvasGroupNode extends JsonCanvasNodeBase<'group'> {
  readonly label?: string
  readonly background?: string
  readonly backgroundStyle?: JsonCanvasBackgroundStyle
}

/** JSON Canvas 1.0 node record. */
export type JsonCanvasNode =
  | JsonCanvasTextNode
  | JsonCanvasFileNode
  | JsonCanvasLinkNode
  | JsonCanvasGroupNode

/** JSON Canvas 1.0 edge record. */
export interface JsonCanvasEdge {
  readonly id: EdgeId
  readonly fromNode: NodeId
  readonly fromSide?: JsonCanvasSide
  readonly fromEnd?: JsonCanvasEdgeEnd
  readonly toNode: NodeId
  readonly toSide?: JsonCanvasSide
  readonly toEnd?: JsonCanvasEdgeEnd
  readonly color?: CanvasColor
  readonly label?: string
}

export interface NuxtBoardNodeMetadata {
  readonly zIndex?: number
  readonly locked?: boolean
  readonly visible?: boolean
  readonly parentId?: NodeId
}

export interface NuxtBoardEdgeMetadata {
  readonly zIndex?: number
  readonly data?: Record<string, unknown>
}

/** nuxt-board metadata for engine state that JSON Canvas 1.0 does not define. */
export interface NuxtBoardDocumentMetadata {
  readonly camera?: Camera
  readonly grid?: GridSettings
  readonly selection?: readonly NodeId[]
  readonly nextZIndex?: number
  readonly nodes?: Readonly<Record<string, NuxtBoardNodeMetadata>>
  readonly edges?: Readonly<Record<string, NuxtBoardEdgeMetadata>>
}

/** Canonical persisted board document. */
export interface JsonCanvasDocument {
  readonly nodes: readonly JsonCanvasNode[]
  readonly edges?: readonly JsonCanvasEdge[]
  readonly 'x-nuxt-board'?: NuxtBoardDocumentMetadata
}

/** Public immutable node shape returned by snapshots, selectors, and commands. */
export interface BoardNode {
  readonly id: NodeId
  readonly type: JsonCanvasNodeType
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color?: CanvasColor
  readonly text?: string
  readonly file?: string
  readonly subpath?: string
  readonly url?: string
  readonly label?: string
  readonly background?: string
  readonly backgroundStyle?: JsonCanvasBackgroundStyle
  readonly zIndex: number
  readonly locked: boolean
  readonly visible: boolean
  readonly parentId?: NodeId
}

/** Input accepted by `createNode`, with sensible defaults for omitted fields. */
export interface NodeInput {
  id?: NodeId
  type?: JsonCanvasNodeType | string
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  file?: string
  subpath?: string
  url?: string
  label?: string
  background?: string
  backgroundStyle?: JsonCanvasBackgroundStyle
  color?: CanvasColor
  locked?: boolean
  visible?: boolean
  parentId?: NodeId
  select?: boolean
}

/** Partial update payload accepted by `updateNode`. */
export type NodePatch = Partial<
  Pick<
    BoardNode,
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'text'
    | 'file'
    | 'subpath'
    | 'url'
    | 'label'
    | 'background'
    | 'backgroundStyle'
    | 'color'
    | 'locked'
    | 'visible'
    | 'parentId'
  >
>

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export type SelectionMode = 'replace' | 'append' | 'toggle'
export type BoxSelectBehavior = 'autocad' | 'contain' | 'intersect'
export type BoxSelectMode = 'window' | 'crossing'

export interface BoxSelectSettings {
  behavior: BoxSelectBehavior
}

/** High-level interaction state for the active pointer or keyboard gesture. */
export type InteractionMode =
  | 'idle'
  | 'panning'
  | 'dragging-nodes'
  | 'resizing-node'
  | 'box-select'
  | 'editing-text'

interface IdleInteractionState {
  mode: 'idle'
}

interface PanInteractionState {
  mode: 'panning'
  pointerId: number
  lastScreenPoint: Point
}

interface DragInteractionState {
  mode: 'dragging-nodes'
  pointerId: number
  nodeIds: NodeId[]
  startScreenPoint: Point
  startNodePositions: Record<NodeId, Point>
}

interface ResizeInteractionState {
  mode: 'resizing-node'
  pointerId: number
  nodeId: NodeId
  handle: ResizeHandle
  startScreenPoint: Point
  startNodeBounds: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>
  aspectRatio: number
}

interface BoxSelectInteractionState {
  mode: 'box-select'
  pointerId: number
  selectionMode: BoxSelectMode
  startScreenPoint: Point
  currentScreenPoint: Point
  startWorldPoint: Point
  currentWorldPoint: Point
}

interface EditingInteractionState {
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
export interface BoardState {
  readonly camera: Camera
  readonly nodes: ReadonlyMap<NodeId, BoardNode>
  readonly selection: ReadonlySet<NodeId>
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
  readonly nextZIndex: number
}

/** Runtime board snapshot used by selectors, renderers, and tests. */
export interface BoardSnapshot {
  readonly camera: Camera
  readonly grid: GridSettings
  readonly nodes: readonly BoardNode[]
  readonly selection: readonly NodeId[]
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
  readonly nextZIndex: number
}

/** Invariant handling strategy for development and tests. */
export type InvariantMode = 'strict' | 'warn' | 'off'

export interface InternalBoardExtensions {}

/** Engine factory options shared by all commands, plugins, and renderers. */
export interface BoardEngineOptions {
  camera?: Partial<Camera>
  zoom?: Partial<ZoomSettings>
  grid?: Partial<GridSettings>
  nodes?: Partial<NodeConstraints>
  boxSelect?: Partial<BoxSelectSettings>
  extensions?: InternalBoardExtension[]
  diagnostics?: boolean | { traceLimit?: number }
  invariants?: InvariantMode
  initialNodes?: ReadonlyArray<BoardNode>
  initialDocument?: JsonCanvasDocument
}

/** Structured invariant violation emitted when validation fails. */
export interface InvariantFailure {
  name: string
  message: string
  snapshot: BoardSnapshot
  context: string
}

/** Trace row recorded when diagnostics are enabled. */
export interface TraceEntry {
  event: string
  timestamp: number
  args: unknown[]
}

/** Event contract emitted by the board engine. Plugins extend this interface via module augmentation. */
export interface BoardEventMap {
  ready: () => void
  destroy: () => void
  'camera:change': (camera: Camera, prev: Camera) => void
  'viewport:change': (size: Point, prev: Point) => void
  'node:created': (node: BoardNode) => void
  'node:updated': (node: BoardNode, prev: BoardNode) => void
  'node:deleted': (id: NodeId, prev: BoardNode) => void
  'node:moved': (node: BoardNode, delta: Point) => void
  'node:resized': (
    node: BoardNode,
    prev: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  ) => void
  'selection:change': (selected: NodeId[], prev: NodeId[]) => void
  'interaction:start': (state: InteractionState) => void
  'interaction:update': (state: InteractionState) => void
  'interaction:end': (state: InteractionState) => void
  'command:before': (name: string, args: unknown[]) => void
  'command:after': (name: string, args: unknown[], duration: number) => void
  'command:blocked': (name: string, args: unknown[]) => void
  'invariant:failed': (failure: InvariantFailure) => void
}

export type PluginCleanup = () => void
export type Unsubscribe = () => void

/**
 * A synchronous command gate for host-level policy such as read-only mode.
 * Call `next()` to allow the command to proceed; omit it to block before state,
 * events, history, or extension reducers are touched.
 */
export type CommandGuard = (
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
export interface BoardEngine {
  readonly ext: InternalBoardExtensions
  readonly $camera: Subscribable<Camera>
  readonly $nodes: Subscribable<ReadonlyMap<NodeId, BoardNode>>
  readonly $selection: Subscribable<ReadonlySet<NodeId>>
  readonly $interaction: Subscribable<InteractionState>
  readonly $snapGuides: Subscribable<readonly SnapGuide[]>
  destroy(): void
  batch(fn: () => void): void
  getState(): BoardState
  getSnapshot(): BoardSnapshot
  getGridSettings(): GridSettings
  getViewportSize(): Point
  updateGridSettings(patch: Partial<GridSettings>): GridSettings
  setViewportSize(size: Point): void
  on<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ): Unsubscribe
  once<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ): Unsubscribe
  off<K extends keyof BoardEventMap>(event: K, handler: BoardEventMap[K]): void
  exportTrace(): TraceEntry[]
  use(extension: InternalBoardExtension): void
  /**
   * Register a synchronous command gate. Intended for concrete host policy such
   * as read-only mode, not broad application orchestration. Returns an
   * unsubscribe function that removes the guard.
   */
  addMiddleware(fn: CommandGuard): Unsubscribe
  screenToWorld(point: Point): Point
  worldToScreen(point: Point): Point
  getVisibleBounds(width: number, height: number): Bounds
  getNode(id: NodeId): BoardNode
  findNode(id: NodeId): BoardNode | null
  hasNode(id: NodeId): boolean
  getNodeAt(worldPoint: Point): BoardNode | null
  getNodesInBounds(bounds: Bounds): BoardNode[]
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
  createNode(input: NodeInput): BoardNode
  updateNode(id: NodeId, patch: NodePatch): BoardNode
  deleteNode(id: NodeId): void
  moveNode(id: NodeId, dx: number, dy: number): BoardNode
  translateSelectedNodes(dx: number, dy: number): void
  resizeNode(
    id: NodeId,
    handle: ResizeHandle,
    dx: number,
    dy: number,
  ): BoardNode
  bringToFront(id: NodeId): void
  sendToBack(id: NodeId): void
  lockNode(id: NodeId): void
  unlockNode(id: NodeId): void
  duplicateNodes(ids: NodeId[], offset?: Point): BoardNode[]
  copySelected(): BoardNode[]
  pasteClipboard(offset?: Point): BoardNode[]
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
  commitTextEdit(id: NodeId, text?: string): BoardNode
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
   * Used by plugins to react to state mutations without polling individual events.
   */
  onAction(
    listener: (action: import('./state/actions').Action) => void,
  ): Unsubscribe
  /**
   * Apply an action directly to engine state without running command guards or
   * command lifecycle events. Used by the history plugin to replay inverse
   * actions during undo/redo.
   */
  applyRecordedAction(action: import('./state/actions').Action): void
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
 * First-party extension surface used by workspace packages such as history and
 * connections. This is internal infrastructure, not a general extension surface.
 */
export interface InternalBoardExtensionContext extends BoardEngine {
  emit<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ): void
  extend<K extends keyof InternalBoardExtensions & string>(
    key: K,
    value: InternalBoardExtensions[K],
  ): void
  /**
   * Execute a named command through the full engine pipeline:
   * command guards → command:before → fn() → invariant validation → command:after.
   * Use this in plugins so that edge/connection operations appear in traces,
   * are interceptable by command guards, and are captured by the history plugin.
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

/** Reducer-backed persistent state owned by a first-party extension. */
interface InternalBoardExtensionSlice {
  initial: unknown
  reducer: (state: never, action: import('./state/actions').Action) => unknown
  /**
   * Optionally invert a plugin-tunneled action so that history can replay its inverse.
   * Receives the inner action body (i.e. `(action as { type: 'PLUGIN' }).action`).
   * Must return an inner action shape suitable for re-dispatching as a PLUGIN action.
   */
  invert?: (innerAction: never) => unknown
}

/** Optional first-party hook for persisted JSON Canvas document data. */
export interface InternalBoardExtensionPersistence {
  exportDocument?(
    engine: InternalBoardExtensionContext,
  ): Partial<JsonCanvasDocument> | void
  importDocument?(
    engine: InternalBoardExtensionContext,
    document: JsonCanvasDocument,
    mode: 'replace' | 'merge',
    idMap: ReadonlyMap<NodeId, NodeId>,
  ): void
}

/** First-party extension contract for state, commands, and side effects. */
export interface InternalBoardExtension {
  name: string
  slice?: InternalBoardExtensionSlice
  persistence?: InternalBoardExtensionPersistence
  install(
    engine: InternalBoardExtensionContext,
    options?: Record<string, unknown>,
  ): void | PluginCleanup
}
