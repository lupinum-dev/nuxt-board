export type NodeId = string
export type EdgeId = string

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Camera {
  x: number
  y: number
  z: number
}

export interface ZoomSettings {
  min: number
  max: number
}

export type GridPattern = 'dot' | 'line' | 'cross' | 'none'

export interface GridSettings {
  size: number
  majorEvery: number
  snap: boolean
  pattern: GridPattern
}

export interface NodeConstraints {
  minWidth: number
  minHeight: number
  defaultWidth: number
  defaultHeight: number
}

export interface CanvasNode<T extends Record<string, unknown> = Record<string, unknown>> {
  id: NodeId
  type: string
  x: number
  y: number
  width: number
  height: number
  data: T
  zIndex: number
  locked: boolean
  visible: boolean
}

export interface NodeInput<T extends Record<string, unknown> = Record<string, unknown>> {
  id?: NodeId
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  data?: T
  locked?: boolean
  visible?: boolean
}

export type NodePatch<T extends Record<string, unknown> = Record<string, unknown>> = Partial<
  Omit<CanvasNode<T>, 'id' | 'type' | 'zIndex'>
>

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export type SelectionMode = 'replace' | 'append' | 'toggle'
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
  startNodeBounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>
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

export interface BoardState {
  camera: Camera
  nodes: Map<NodeId, CanvasNode>
  selection: Set<NodeId>
  interaction: InteractionState
  nextZIndex: number
}

export interface BoardSnapshot {
  camera: Camera
  grid: GridSettings
  nodes: CanvasNode[]
  selection: NodeId[]
  interaction: InteractionState
  nextZIndex: number
}

export type InvariantMode = 'strict' | 'warn' | 'off'

export interface CanvasEngineOptions {
  camera?: Partial<Camera>
  zoom?: Partial<ZoomSettings>
  grid?: Partial<GridSettings>
  nodes?: Partial<NodeConstraints>
  plugins?: CanvasPlugin[]
  diagnostics?: boolean | { traceLimit?: number }
  invariants?: InvariantMode
  initialNodes?: CanvasNode[]
}

export interface InvariantFailure {
  name: string
  message: string
  snapshot: BoardSnapshot
  context: string
}

export interface TraceEntry {
  event: keyof CanvasEventMap | string
  timestamp: number
  args: unknown[]
}

export interface CanvasPluginContext extends CanvasEngine {
  emit<K extends keyof CanvasEventMap>(event: K, ...args: Parameters<CanvasEventMap[K]>): void
}

export interface CanvasPlugin {
  name: string
  install(engine: CanvasPluginContext, options?: Record<string, unknown>): void | PluginCleanup
}

export type PluginCleanup = () => void
export type Unsubscribe = () => void

export interface CanvasEventMap {
  ready: () => void
  destroy: () => void
  'camera:change': (camera: Camera, prev: Camera) => void
  'node:created': (node: CanvasNode) => void
  'node:updated': (node: CanvasNode, prev: CanvasNode) => void
  'node:deleted': (id: NodeId, prev: CanvasNode) => void
  'node:moved': (node: CanvasNode, delta: Point) => void
  'node:resized': (node: CanvasNode, prev: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>) => void
  'selection:change': (selected: NodeId[], prev: NodeId[]) => void
  'interaction:start': (state: InteractionState) => void
  'interaction:update': (state: InteractionState) => void
  'interaction:end': (state: InteractionState) => void
  'command:before': (name: string, args: unknown[]) => void
  'command:after': (name: string, args: unknown[], duration: number) => void
  'invariant:failed': (failure: InvariantFailure) => void
}

export interface CanvasEngine {
  getState(): Readonly<BoardState>
  getSnapshot(): BoardSnapshot
  getGridSettings(): GridSettings
  getViewportSize(): Point
  updateGridSettings(patch: Partial<GridSettings>): GridSettings
  setViewportSize(size: Point): void
  on<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]): Unsubscribe
  once<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]): Unsubscribe
  off<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]): void
  exportTrace(): TraceEntry[]
  use(plugin: CanvasPlugin): void
  screenToWorld(point: Point): Point
  worldToScreen(point: Point): Point
  getVisibleBounds(width: number, height: number): Bounds
  getNodeAt(worldPoint: Point): CanvasNode | null
  getNodesInBounds(bounds: Bounds): CanvasNode[]
  panBy(dx: number, dy: number): void
  panTo(worldPoint: Point, animated?: boolean): Promise<void>
  zoomAt(screenPoint: Point, delta: number): void
  zoomTo(level: number, animated?: boolean): Promise<void>
  zoomToFit(padding?: number, animated?: boolean): Promise<void>
  zoomToNodes(ids: NodeId[], padding?: number, animated?: boolean): Promise<void>
  createNode<T extends Record<string, unknown> = Record<string, unknown>>(input: NodeInput<T>): CanvasNode<T>
  updateNode<T extends Record<string, unknown> = Record<string, unknown>>(id: NodeId, patch: NodePatch<T>): CanvasNode<T>
  deleteNode(id: NodeId): void
  moveNode(id: NodeId, dx: number, dy: number): CanvasNode
  resizeNode(id: NodeId, handle: ResizeHandle, dx: number, dy: number): CanvasNode
  bringToFront(id: NodeId): void
  sendToBack(id: NodeId): void
  lockNode(id: NodeId): void
  unlockNode(id: NodeId): void
  duplicateNodes(ids: NodeId[], offset?: Point): CanvasNode[]
  copySelected(): CanvasNode[]
  pasteClipboard(offset?: Point): CanvasNode[]
  select(ids: NodeId | NodeId[], mode?: SelectionMode): void
  selectAll(): void
  clearSelection(): void
  deleteSelected(): void
  getSelection(): NodeId[]
  beginPan(pointerId: number, screenPoint: Point): void
  beginNodeDrag(id: NodeId, pointerId: number, screenPoint: Point): void
  beginResize(id: NodeId, handle: ResizeHandle, pointerId: number, screenPoint: Point): void
  beginBoxSelect(pointerId: number, screenPoint: Point): void
  beginTextEdit(id: NodeId): void
  commitTextEdit(id: NodeId, text?: string): CanvasNode
  updatePointer(pointerId: number, screenPoint: Point): void
  endInteraction(pointerId?: number): void
  exportJSON(): string
  importJSON(json: string, mode?: 'replace' | 'merge'): void
}
