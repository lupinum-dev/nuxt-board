import type { GridSettings, NodeId, Point } from '../types.js'
import type { StoredNode } from './versioning.js'

export interface NodeMoveDelta {
  id: NodeId
  before: Point
  after: Point
}

export type Action =
  | { type: 'NODE_CREATED'; node: StoredNode }
  | { type: 'NODE_UPDATED'; id: NodeId; before: StoredNode; after: StoredNode }
  | { type: 'NODE_DELETED'; node: StoredNode }
  | { type: 'NODES_MOVED'; deltas: NodeMoveDelta[] }
  | { type: 'SELECTION_SET'; before: NodeId[]; after: NodeId[] }
  | { type: 'GRID_UPDATED'; before: GridSettings; after: GridSettings }
  | { type: 'NEXT_Z_INDEX_BUMPED'; before: number; after: number }
  | { type: 'BATCH'; actions: Action[] }
  | { type: 'FEATURE_ACTION'; feature: string; action: unknown }
