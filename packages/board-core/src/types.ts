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

/** Legacy persisted metadata namespace accepted on import only. */
export type NuxtBoardDocumentMetadata = VueBoardDocumentMetadata

/** Canonical persisted board document. */
export interface JsonCanvasDocument {
  readonly nodes: readonly JsonCanvasNode[]
  readonly edges?: readonly JsonCanvasEdge[]
  readonly 'x-vue-board'?: VueBoardDocumentMetadata
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

/** Validation handling strategy for development and tests. */
export type ValidationMode = 'strict' | 'warn' | 'off'

export interface BoardFeatureExtensions {}

/** Opaque install token produced by internal extension packages. */
export interface BoardExtension {
  readonly name: string
  readonly __boardExtensionBrand: never
}

/** Engine factory options shared by commands, internal features, and renderers. */
export interface BoardEngineOptions {
  camera?: Partial<Camera>
  zoom?: Partial<ZoomSettings>
  grid?: Partial<GridSettings>
  nodes?: Partial<NodeConstraints>
  boxSelect?: Partial<BoxSelectSettings>
  extensions?: BoardExtension[]
  diagnostics?: boolean | { traceLimit?: number }
  validation?: ValidationMode
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

/** Explicit command lifecycle metadata consumed by internal features. */
export interface CommandMetadata {
  history: CommandHistoryPolicy
  validate?: boolean
}

/** Event contract emitted by the board engine. Internal features extend this interface via module augmentation. */
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

export type FeatureCleanup = () => void
export type Unsubscribe = () => void

/**
 * A synchronous command gate for host-level policy such as read-only mode.
 * Call `next()` to allow the command to proceed; omit it to block before state,
 * events, history, or feature reducers are touched.
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
export interface BoardEngine {
  readonly ext: BoardFeatureExtensions
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
}

/**
 * Internal feature surface used by workspace packages such as history and
 * connections. This is internal infrastructure, not a general plugin surface.
 */
export interface InternalFeatureContext<
  TExtensions extends BoardFeatureExtensions = BoardFeatureExtensions,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> extends Omit<BoardEngine, 'ext'> {
  readonly ext: TExtensions
  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void
  extend<K extends keyof TExtensions & string>(
    key: K,
    value: TExtensions[K],
  ): void
  /**
   * Execute a named mutation through guarded command handling:
   * command guards → command:before → fn() → validation → command:after.
   * Use this in internal features so edge/connection operations appear in traces,
   * are interceptable by command guards, and are captured by the history feature.
   */
  runCommand<T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata: CommandMetadata,
  ): T
  /**
   * Dispatch an action. Called by command implementations to record state mutations
   * and notify subscribers (history, feature reducers).
   */
  dispatch(action: import('./state/actions').Action): void
  /**
   * Read the current slice state for this feature, as last produced by its reducer.
   */
  getFeatureState<S>(): S
  /**
   * Subscribe to actions dispatched by commands.
   * Used by internal features to react to state mutations without polling individual events.
   */
  onAction(
    listener: (action: import('./state/actions').Action) => void,
  ): Unsubscribe
  /**
   * Apply an action directly to engine state without running command guards or
   * command lifecycle events. Used by the history feature to replay inverse
   * actions during undo/redo.
   */
  applyRecordedAction(action: import('./state/actions').Action): void
  /**
   * Compute the inverse of an action. Used by the history feature.
   * Feature-tunneled actions are inverted via the registering feature's
   * `slice.invert` if present; otherwise an error is thrown.
   */
  invertAction(
    action: import('./state/actions').Action,
  ): import('./state/actions').Action
}

/** Reducer-backed persistent state owned by a internal feature. */
interface InternalFeatureSlice {
  initial: unknown
  reducer: (state: never, action: import('./state/actions').Action) => unknown
  /**
   * Optionally invert a feature-tunneled action so that history can replay its inverse.
   * Receives the inner action body (i.e. `(action as { type: 'FEATURE_ACTION' }).action`).
   * Must return an inner action shape suitable for re-dispatching as a FEATURE_ACTION action.
   */
  invert?: (innerAction: never) => unknown
}

/** Optional internal hook for persisted JSON Canvas document data. */
export interface InternalFeaturePersistence<
  TExtensions extends BoardFeatureExtensions = BoardFeatureExtensions,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> {
  exportDocument?(
    engine: InternalFeatureContext<TExtensions, TEvents>,
  ): Partial<JsonCanvasDocument> | void
  importDocument?(
    engine: InternalFeatureContext<TExtensions, TEvents>,
    document: JsonCanvasDocument,
    mode: 'replace' | 'merge',
    idMap: ReadonlyMap<NodeId, NodeId>,
  ): void
}

/** Internal feature contract for state, commands, and side effects. */
export interface InternalBoardFeature<
  TExtensions extends BoardFeatureExtensions = BoardFeatureExtensions,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> extends BoardExtension {
  name: string
  slice?: InternalFeatureSlice
  persistence?: InternalFeaturePersistence<TExtensions, TEvents>
  install(
    engine: InternalFeatureContext<TExtensions, TEvents>,
    options?: Record<string, unknown>,
  ): void | FeatureCleanup
}

export type InternalBoardFeatureDefinition<
  TExtensions extends BoardFeatureExtensions = BoardFeatureExtensions,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
> = Omit<InternalBoardFeature<TExtensions, TEvents>, keyof BoardExtension> & {
  readonly name: string
}
