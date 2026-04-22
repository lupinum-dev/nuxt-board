import type { Bounds, BoardNode, EdgeId, NodeId, Point } from '@lupinum/board-core'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
export type ConnectionRouting = 'bezier' | 'smooth-step' | 'step' | 'straight' | 'arc'
export type EdgeEnd = 'none' | 'arrow'
export type EndpointResolutionKind = 'explicit' | 'auto'

export interface AnchorPosition {
  side: AnchorSide
  offset: number
}

export interface BoardEdge<T = Record<string, unknown>> {
  id: EdgeId
  from: NodeId
  to: NodeId
  fromAnchor?: AnchorPosition
  toAnchor?: AnchorPosition
  fromEnd?: EdgeEnd
  toEnd?: EdgeEnd
  label?: string
  color?: string
  data: T
  zIndex: number
}

export interface BoardEdgePatch<T = Record<string, unknown>> {
  from?: NodeId
  to?: NodeId
  fromAnchor?: AnchorPosition
  toAnchor?: AnchorPosition
  fromEnd?: EdgeEnd
  toEnd?: EdgeEnd
  label?: string
  color?: string
  data?: T
}

export interface ConnectionPluginOptions {
  routing?: ConnectionRouting
  defaultArrow?: 'none' | 'start' | 'end' | 'both'
  snapDistance?: number
}

export interface ConnectionsExtension {
  createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
  ): BoardEdge<T>
  updateEdge<T extends Record<string, unknown> = Record<string, unknown>>(id: EdgeId, patch: BoardEdgePatch<T>): BoardEdge<T>
  deleteEdge(id: EdgeId): void
  getEdge(id: EdgeId): BoardEdge | undefined
  getEdges(): BoardEdge[]
  getEdgesFrom(id: NodeId): BoardEdge[]
  getEdgesTo(id: NodeId): BoardEdge[]
  getEdgesBetween(from: NodeId, to: NodeId): BoardEdge[]
}

export interface ResolvedConnectionEndpoint {
  nodeId: NodeId
  node: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>
  side: AnchorSide
  offset: number
  point: Point
  kind: EndpointResolutionKind
}

export type ConnectionRouteSegment =
  | { type: 'line'; from: Point; to: Point }
  | { type: 'cubic'; from: Point; control1: Point; control2: Point; to: Point }

export interface ConnectionRoute {
  routing: ConnectionRouting
  path: string
  labelPoint: Point
  bounds: Bounds
  waypoints: Point[]
  segments: ConnectionRouteSegment[]
}
