import type {
  BoardEventMap,
  Camera,
  GridSettings,
  InteractionState,
  NodeConstraints,
  NodeId,
  NodeTypeRegistry,
  Point,
  SnapGuide,
  ZoomSettings,
} from '../types'
import type { StoredNode } from './versioning'

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

export interface MutableBoardState<R extends NodeTypeRegistry> {
  camera: Camera
  nodes: Map<NodeId, StoredNode>
  selection: Set<NodeId>
  interaction: InteractionState
  snapGuides: SnapGuide[]
  nextZIndex: number
}

export type ListenerMap<R extends NodeTypeRegistry> = Map<
  keyof BoardEventMap<R>,
  Set<(...args: unknown[]) => void>
>
