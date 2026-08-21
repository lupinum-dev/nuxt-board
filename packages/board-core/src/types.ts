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

/** A value that can be persisted without changing its JSON representation. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

/** A JSON object used for extension-owned persisted data. */
export type JsonObject = { readonly [key: string]: JsonValue }

interface JsonCanvasNodeBase<TType extends JsonCanvasNodeType> {
  readonly id: string
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
  readonly id: string
  readonly fromNode: string
  readonly fromSide?: JsonCanvasSide
  readonly fromEnd?: JsonCanvasEdgeEnd
  readonly toNode: string
  readonly toSide?: JsonCanvasSide
  readonly toEnd?: JsonCanvasEdgeEnd
  readonly color?: CanvasColor
  readonly label?: string
}

export interface BoardNodeMetadata {
  readonly zIndex?: number
  readonly locked?: boolean
  readonly visible?: boolean
  readonly parentId?: string
}

export interface BoardEdgeMetadata {
  readonly zIndex?: number
  readonly data?: JsonObject
}

/** Nuxt Board metadata for engine state that JSON Canvas 1.0 does not define. */
export interface BoardDocumentMetadata {
  readonly camera?: Camera
  readonly grid?: GridSettings
  readonly selection?: readonly string[]
  readonly nextZIndex?: number
  readonly nodes?: Readonly<Record<string, BoardNodeMetadata>>
  readonly edges?: Readonly<Record<string, BoardEdgeMetadata>>
}

/** Canonical persisted board document. */
export interface JsonCanvasDocument {
  readonly nodes: readonly JsonCanvasNode[]
  readonly edges?: readonly JsonCanvasEdge[]
  readonly 'x-lupinum-board'?: BoardDocumentMetadata
}

interface BoardNodeBase {
  readonly id: NodeId
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color?: CanvasColor
  readonly zIndex: number
  readonly locked: boolean
  readonly visible: boolean
  readonly parentId?: NodeId
}

/** Canonical immutable node shape returned by state, selectors, and commands. */
export type BoardNode =
  | (BoardNodeBase & {
      readonly type: 'text'
      readonly text: string
      readonly file?: never
      readonly subpath?: never
      readonly url?: never
      readonly label?: never
      readonly background?: never
      readonly backgroundStyle?: never
    })
  | (BoardNodeBase & {
      readonly type: 'file'
      readonly file: string
      readonly subpath?: string
      readonly text?: never
      readonly url?: never
      readonly label?: never
      readonly background?: never
      readonly backgroundStyle?: never
    })
  | (BoardNodeBase & {
      readonly type: 'link'
      readonly url: string
      readonly text?: never
      readonly file?: never
      readonly subpath?: never
      readonly label?: never
      readonly background?: never
      readonly backgroundStyle?: never
    })
  | (BoardNodeBase & {
      readonly type: 'group'
      readonly label?: string
      readonly background?: string
      readonly backgroundStyle?: JsonCanvasBackgroundStyle
      readonly text?: never
      readonly file?: never
      readonly subpath?: never
      readonly url?: never
    })

interface NodeInputBase {
  id?: NodeId
  x?: number
  y?: number
  width?: number
  height?: number
  color?: CanvasColor
  locked?: boolean
  visible?: boolean
  parentId?: NodeId
  select?: boolean
}

/** Input accepted by `createNode`, with text defaults and explicit file/link values. */
export type NodeInput =
  | (NodeInputBase & {
      type?: 'text'
      text?: string
      file?: never
      subpath?: never
      url?: never
      label?: never
      background?: never
      backgroundStyle?: never
    })
  | (NodeInputBase & {
      type: 'file'
      file: string
      subpath?: string
      text?: never
      url?: never
      label?: never
      background?: never
      backgroundStyle?: never
    })
  | (NodeInputBase & {
      type: 'link'
      url: string
      text?: never
      file?: never
      subpath?: never
      label?: never
      background?: never
      backgroundStyle?: never
    })
  | (NodeInputBase & {
      type: 'group'
      label?: string
      background?: string
      backgroundStyle?: JsonCanvasBackgroundStyle
      text?: never
      file?: never
      subpath?: never
      url?: never
    })

/** Partial update payload accepted by `updateNode`. */
export interface NodePatch {
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
}

/** Nodes created by duplication plus the canonical source-to-copy identity map. */
export interface DuplicateNodesResult {
  readonly nodes: readonly BoardNode[]
  readonly idMap: ReadonlyMap<NodeId, NodeId>
}

/** Clipboard hook used to translate host payloads into board nodes. */
export interface BoardClipboardHooks {
  deserialize(payload: unknown): NodeInput[] | null
}

/** Options controlling how a validated document enters the current board. */
export interface DocumentLoadOptions {
  mode?: 'replace' | 'merge'
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

/** Immutable effective runtime state exposed through `getState()`. */
export interface BoardState {
  readonly camera: Camera
  readonly grid: GridSettings
  readonly nodes: ReadonlyMap<NodeId, BoardNode>
  readonly selection: ReadonlySet<NodeId>
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
}

/** Internal array form used for document normalization, validation, and encoding. */
export interface InternalBoardSnapshot {
  readonly camera: Camera
  readonly grid: GridSettings
  readonly nodes: readonly BoardNode[]
  readonly selection: readonly NodeId[]
  readonly interaction: InteractionState
  readonly snapGuides: readonly SnapGuide[]
  readonly nextZIndex: number
}

export interface BoardPluginApis {}

/** Opaque install token carrying the API and events installed by a plugin factory. */
export interface BoardPlugin<
  TApis extends BoardPluginApis = BoardPluginApis,
  TEvents = {},
> {
  readonly name: string
  readonly __boardPluginBrand: never
  readonly __boardPluginApis: TApis
  readonly __boardPluginEvents: TEvents
}

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type PluginApi<TPlugin> =
  TPlugin extends BoardPlugin<infer TApis, infer _TEvents> ? TApis : never

type PluginEvents<TPlugin> =
  TPlugin extends BoardPlugin<infer _TApis, infer TEvents> ? TEvents : never

type InstalledPluginApisForTuple<TPlugins extends readonly BoardPlugin[]> = [
  TPlugins[number],
] extends [never]
  ? BoardPluginApis
  : BoardPluginApis & UnionToIntersection<PluginApi<TPlugins[number]>>

type InstalledPluginEventsForTuple<TPlugins extends readonly BoardPlugin[]> = [
  TPlugins[number],
] extends [never]
  ? {}
  : UnionToIntersection<PluginEvents<TPlugins[number]>>

/**
 * Distribute over conditional plugin tuples so only APIs present in every
 * possible runtime branch can be accessed without narrowing.
 */
export type InstalledPluginApis<TPlugins extends readonly BoardPlugin[]> =
  TPlugins extends readonly BoardPlugin[]
    ? InstalledPluginApisForTuple<TPlugins>
    : never

export type InstalledPluginEvents<TPlugins extends readonly BoardPlugin[]> =
  TPlugins extends readonly BoardPlugin[]
    ? InstalledPluginEventsForTuple<TPlugins>
    : never

/** Context for failures reported after the engine can no longer roll back work. */
export type BoardUnhandledErrorContext =
  | { readonly source: 'event-listener'; readonly event: string }
  | { readonly source: 'subscriber'; readonly channel: string }
  | { readonly source: 'commit-effect'; readonly commit: string }

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
  clipboard?: BoardClipboardHooks
  diagnostics?: boolean | { traceLimit?: number }
  onUnhandledError?: (
    error: unknown,
    context: BoardUnhandledErrorContext,
  ) => void
  initialNodes?: ReadonlyArray<BoardNode>
  initialDocument?: JsonCanvasDocument
}

/** Structured validation failure emitted when validation fails. */
export interface ValidationFailure {
  name: string
  message: string
  state: BoardState
  context: string
}

/** Trace row recorded when diagnostics are enabled. */
export interface TraceEntry {
  readonly event: string
  readonly timestamp: number
  readonly args: readonly unknown[]
}

/** History capture policy attached to command lifecycle events. */
export type CommandHistoryPolicy = 'record' | 'ignore'

/** Explicit command lifecycle metadata consumed by internal plugins. */
export interface CommandMetadata {
  history: CommandHistoryPolicy
}

/** Base event contract emitted by every board engine. Installed plugin tuples add their own event maps. */
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

/** Immutable command description evaluated by host policy guards. */
export interface CommandContext {
  readonly name: string
  readonly args: readonly unknown[]
  readonly metadata: CommandMetadata
}

/** Allow a command with `true`, or block it with an actionable reason. */
export type CommandGuard = (command: Readonly<CommandContext>) => true | string

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
  TPluginEvents = {},
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
  getGridSettings(): GridSettings
  getViewportSize(): Point
  updateGridSettings(patch: Partial<GridSettings>): GridSettings
  setViewportSize(size: Point): void
  on<K extends keyof (BoardEventMap & TPluginEvents)>(
    event: K,
    handler: (BoardEventMap & TPluginEvents)[K],
  ): Unsubscribe
  once<K extends keyof (BoardEventMap & TPluginEvents)>(
    event: K,
    handler: (BoardEventMap & TPluginEvents)[K],
  ): Unsubscribe
  off<K extends keyof (BoardEventMap & TPluginEvents)>(
    event: K,
    handler: (BoardEventMap & TPluginEvents)[K],
  ): void
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
  /** Paste a host payload, or return `null` when the hook does not recognize it. */
  pasteData(payload: unknown, offset?: Point): BoardNode[] | null
  select(ids: NodeId | NodeId[], mode?: SelectionMode): void
  selectAll(): void
  clearSelection(): void
  deleteSelected(): void
  getSelection(): NodeId[]
  beginTextEdit(id: NodeId): void
  commitTextEdit(id: NodeId, text?: string): BoardNode
  cancelTextEdit(): void
  exportDocument(): JsonCanvasDocument
  loadDocument(document: unknown, options?: DocumentLoadOptions): void
}

/** Sealed pointer/session adapter consumed by framework integrations. */
export interface InternalInteractionAdapter {
  beginPan(pointerId: number, screenPoint: Point): void
  beginNodeDrag(id: NodeId, pointerId: number, screenPoint: Point): void
  beginResize(
    id: NodeId,
    handle: ResizeHandle,
    pointerId: number,
    screenPoint: Point,
  ): void
  beginBoxSelect(pointerId: number, screenPoint: Point): void
  updatePointer(
    pointerId: number,
    screenPoint: Point,
    modifiers?: { shift?: boolean; space?: boolean },
  ): void
  endInteraction(pointerId?: number): void
  cancelInteraction(pointerId?: number): void
  getUniformTranslationTargets(seedIds: NodeId[]): NodeId[]
  syncGroupZOrder(groupId: NodeId): void
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
  TState = unknown,
> extends Omit<BoardEngine, 'plugins'> {
  readonly plugins: TPluginApis
  /** Assert that the owning engine has not been destroyed. */
  assertActive(): void
  /** Whether the current command has joined an explicit outer batch. */
  isBatching(): boolean
  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void
  extend<K extends keyof TPluginApis & string>(
    key: K,
    value: TPluginApis[K],
  ): void
  /**
   * Execute a named mutation through guarded command handling. Successful
   * lifecycle events publish after validation; guards are the pre-execution hook.
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
  getPluginState(): TState
  /** Replace the current plugin's persistent slice inside the active command. */
  updatePluginState(update: (current: TState) => TState): TState
  /** Project persistent plugin state through the canonical subscribable lifecycle. */
  createCommitSubscribable<T>(select: () => T, channel: string): Subscribable<T>
  /** Prepare final bookkeeping/event publication for a validated outer commit. The effect cannot mutate or destroy the board. */
  projectCommit(
    projector: (
      commit: import('./state/types.js').InternalBoardCommit,
    ) => () => void,
  ): Unsubscribe
  /** Atomically restore a persistent root without recording another history frame. */
  restoreHistoryRoot(root: import('./state/types.js').InternalHistoryRoot): void
}

/** Persistent state owned by an internal plugin. */
interface InternalPluginSlice<TState> {
  initial: TState
}

/** Optional internal hook for persisted JSON Canvas document data. */
export interface InternalPluginPersistence<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
  TState = unknown,
> {
  exportDocument?(
    engine: InternalPluginContext<TPluginApis, TEvents, TState>,
  ): Partial<JsonCanvasDocument> | void
  loadDocument?(
    engine: InternalPluginContext<TPluginApis, TEvents, TState>,
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
  TState = unknown,
> extends BoardPlugin<TPluginApis, TEvents> {
  name: string
  slice?: InternalPluginSlice<TState>
  persistence?: InternalPluginPersistence<TPluginApis, TEvents, TState>
  nodeDeleted?(
    engine: InternalPluginContext<TPluginApis, TEvents, TState>,
    nodeId: NodeId,
  ): void
  install(
    engine: InternalPluginContext<TPluginApis, TEvents, TState>,
    options?: Record<string, unknown>,
  ): void | PluginCleanup
}

export type InternalBoardPluginDefinition<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
  TState = unknown,
> = Omit<
  InternalBoardPlugin<TPluginApis, TEvents, TState>,
  keyof BoardPlugin
> & {
  readonly name: string
}
