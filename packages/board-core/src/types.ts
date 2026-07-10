/**
 * A nominal type helper used to distinguish identifiers that are both strings at runtime.
 */
type Brand<T, K extends string> = T & { readonly __brand: K }

/** Unique identifier for a board node. */
export type NodeId = Brand<string, 'NodeId'>
/** Unique identifier for a connection edge. */
export type EdgeId = Brand<string, 'EdgeId'>

/** Compile-time-only cast into a branded node id. This does not validate runtime input. */
export const asNodeId = (value: string): NodeId => value as NodeId
/** Compile-time-only cast into a branded edge id. This does not validate runtime input. */
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

export interface VueBoardNodeMetadata {
  readonly zIndex?: number
  readonly locked?: boolean
  readonly visible?: boolean
  readonly parentId?: NodeId
}

export interface VueBoardEdgeMetadata {
  readonly zIndex?: number
  readonly data?: Record<string, unknown>
}

/** Vue Board metadata for engine state that JSON Canvas 1.0 does not define. */
export interface VueBoardDocumentMetadata {
  readonly camera?: Camera
  readonly grid?: GridSettings
  readonly selection?: readonly NodeId[]
  readonly nextZIndex?: number
  readonly nodes?: Readonly<Record<string, VueBoardNodeMetadata>>
  readonly edges?: Readonly<Record<string, VueBoardEdgeMetadata>>
}

/** Canonical persisted board document. */
export interface JsonCanvasDocument {
  readonly nodes: readonly JsonCanvasNode[]
  readonly edges?: readonly JsonCanvasEdge[]
  readonly 'x-vue-board'?: VueBoardDocumentMetadata
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
  type?: JsonCanvasNodeType
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

/** Nodes created by duplication plus the canonical source-to-copy identity map. */
export interface DuplicateNodesResult {
  readonly nodes: readonly BoardNode[]
  readonly idMap: ReadonlyMap<NodeId, NodeId>
}

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
  readonly grid: GridSettings
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

export interface BoardPluginApis {}

/** Opaque install token carrying the API installed by a plugin factory. */
export interface BoardPlugin<TApis extends BoardPluginApis = BoardPluginApis> {
  readonly name: string
  readonly __boardPluginBrand: never
  readonly __boardPluginApis: TApis
}

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type PluginApi<TPlugin> =
  TPlugin extends BoardPlugin<infer TApis> ? TApis : never

export type InstalledPluginApis<TPlugins extends readonly BoardPlugin[]> = [
  TPlugins[number],
] extends [never]
  ? BoardPluginApis
  : BoardPluginApis & UnionToIntersection<PluginApi<TPlugins[number]>>

/** Engine factory options shared by commands, internal plugins, and renderers. */
export interface BoardEngineOptions<
  TPlugins extends readonly BoardPlugin[] = readonly [],
> {
  camera?: Partial<Camera>
  zoom?: Partial<ZoomSettings>
  grid?: Partial<GridSettings>
  nodes?: Partial<NodeConstraints>
  boxSelect?: Partial<BoxSelectSettings>
  plugins?: TPlugins
  diagnostics?: boolean | { traceLimit?: number }
  initialNodes?: ReadonlyArray<BoardNode>
  initialDocument?: JsonCanvasDocument
}

/** Structured validation failure emitted when validation fails. */
export interface ValidationFailure {
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

/** History capture policy attached to command lifecycle events. */
export type CommandHistoryPolicy = 'record' | 'ignore'

/** Explicit command lifecycle metadata consumed by internal plugins. */
export interface CommandMetadata {
  history: CommandHistoryPolicy
}

/** Event contract emitted by the board engine. Internal features extend this interface via module augmentation. */
export interface BoardEventMap {
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
  'command:before': (
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ) => void
  'command:after': (
    name: string,
    args: unknown[],
    duration: number,
    metadata: CommandMetadata,
  ) => void
  'command:blocked': (
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ) => void
  'validation:failed': (failure: ValidationFailure) => void
}

export type PluginCleanup = () => void
export type Unsubscribe = () => void

/**
 * A synchronous command gate for host-level policy such as read-only mode.
 * Call `next()` to allow the command to proceed; omit it to block before state,
 * events, history, or plugin reducers are touched.
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
 * and events let host applications observe lifecycle changes.
 */
export interface BoardEngine<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
> {
  readonly plugins: TPluginApis
  readonly $camera: Subscribable<Camera>
  readonly $grid: Subscribable<GridSettings>
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
  /**
   * Register a synchronous command gate. Intended for concrete host policy such
   * as read-only mode, not broad application orchestration. Returns an
   * unsubscribe function that removes the guard.
   */
  addCommandGuard(fn: CommandGuard): Unsubscribe
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
  duplicateNodes(ids: NodeId[], offset?: Point): DuplicateNodesResult
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
}

/**
 * Internal plugin surface used by workspace packages such as history and
 * connections. This is internal infrastructure, not a general plugin surface.
 */
export interface InternalPluginContext<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> extends Omit<BoardEngine, 'plugins'> {
  readonly plugins: TPluginApis
  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void
  extend<K extends keyof TPluginApis & string>(
    key: K,
    value: TPluginApis[K],
  ): void
  /**
   * Execute a named mutation through guarded command handling:
   * command guards → command:before → fn() → validation → command:after.
   * Use this in internal plugins so edge/connection operations appear in traces,
   * are interceptable by command guards, and are captured by the history plugin.
   */
  runCommand<T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata: CommandMetadata,
  ): T
  /** Read the immutable persistent slice owned by the current plugin. */
  getPluginState<S>(): S
  /** Replace the current plugin's persistent slice inside the active command. */
  updatePluginState<S>(update: (current: S) => S): S
  /** Observe successful outer commits after state and public effects publish. */
  onCommit(
    listener: (commit: import('./state/types.js').InternalBoardCommit) => void,
  ): Unsubscribe
  /** Atomically restore a persistent root without recording another history frame. */
  restoreHistoryRoot(root: import('./state/types.js').InternalHistoryRoot): void
}

/** Persistent state owned by an internal plugin. */
interface InternalPluginSlice {
  initial: unknown
}

/** Optional internal hook for persisted JSON Canvas document data. */
export interface InternalPluginPersistence<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> {
  exportDocument?(
    engine: InternalPluginContext<TPluginApis, TEvents>,
  ): Partial<JsonCanvasDocument> | void
  importDocument?(
    engine: InternalPluginContext<TPluginApis, TEvents>,
    document: JsonCanvasDocument,
    mode: 'replace' | 'merge',
    idMap: ReadonlyMap<NodeId, NodeId>,
  ): void
}

/** Internal plugin contract for state, commands, and side effects. */
export interface InternalBoardPlugin<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> extends BoardPlugin<TPluginApis> {
  name: string
  slice?: InternalPluginSlice
  persistence?: InternalPluginPersistence<TPluginApis, TEvents>
  nodeDeleted?(
    engine: InternalPluginContext<TPluginApis, TEvents>,
    nodeId: NodeId,
  ): void
  install(
    engine: InternalPluginContext<TPluginApis, TEvents>,
    options?: Record<string, unknown>,
  ): void | PluginCleanup
}

export type InternalBoardPluginDefinition<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> = Omit<InternalBoardPlugin<TPluginApis, TEvents>, keyof BoardPlugin> & {
  readonly name: string
}
