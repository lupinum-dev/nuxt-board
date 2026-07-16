import type {
  BoardEventMap,
  BoardNode,
  Camera,
  CommandMetadata,
  GridSettings,
  InteractionState,
  NodeConstraints,
  NodeId,
  Point,
  SnapGuide,
  ZoomSettings,
} from '../types.js'

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, z: 1 }
export const DEFAULT_ZOOM: ZoomSettings = { min: 0.1, max: 8 }
export const DEFAULT_GRID: GridSettings = {
  size: 10,
  majorEvery: 5,
  snap: true,
  edgeSnap: true,
  edgeSnapThreshold: 8,
  pattern: 'line',
}
export const DEFAULT_NODE_CONSTRAINTS: NodeConstraints = {
  minWidth: 50,
  minHeight: 50,
  defaultWidth: 240,
  defaultHeight: 160,
}
export const DEFAULT_VIEWPORT_SIZE: Point = { x: 1280, y: 720 }

export interface MutableBoardState {
  camera: Camera
  nodes: Map<NodeId, BoardNode>
  selection: Set<NodeId>
  interaction: InteractionState
  snapGuides: SnapGuide[]
  nextZIndex: number
}

export type ListenerMap = Map<
  keyof BoardEventMap,
  Set<(...args: unknown[]) => void>
>

/** Structurally shared persistent state captured by first-party history. */
export interface InternalHistoryRoot {
  readonly nodes: ReadonlyMap<NodeId, BoardNode>
  readonly grid: GridSettings
  readonly selection: ReadonlySet<NodeId>
  readonly nextZIndex: number
  readonly pluginSlices: ReadonlyMap<string, unknown>
}

/** A successfully published outer command. */
export interface InternalBoardCommit {
  readonly label: string
  readonly timestamp: number
  readonly metadata: CommandMetadata
  readonly before: InternalHistoryRoot
  readonly after: InternalHistoryRoot
}
