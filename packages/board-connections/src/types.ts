import type {
  Bounds,
  BoardNode,
  EdgeId,
  NodeId,
  Point,
} from '@lupinum/board-core'

/** Side of a rectangular node used for connection anchors. */
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
/** Routing strategy used when rendering a connection edge. */
export type ConnectionRouting =
  | 'bezier'
  | 'smooth-step'
  | 'step'
  | 'straight'
  | 'arc'
/** Marker rendered at either end of an edge. */
export type EdgeEnd = 'none' | 'arrow'
/** Whether an endpoint came from an explicit anchor or automatic side resolution. */
export type EndpointResolutionKind = 'explicit' | 'auto'

/** Anchor location along a given node side, with `offset` normalized from 0 to 1. */
export interface AnchorPosition {
  side: AnchorSide
  offset: number
}

/** Persistent edge record owned by the connections plugin. */
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

/** Partial update payload accepted by `updateEdge`. */
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

/** Options for configuring the connections plugin defaults. */
export interface ConnectionPluginOptions {
  routing?: ConnectionRouting
  defaultArrow?: 'none' | 'start' | 'end' | 'both'
  snapDistance?: number
}

/** Engine extension installed by the connections plugin. */
export interface ConnectionsExtension {
  createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & {
      id?: EdgeId
      zIndex?: number
    },
  ): BoardEdge<T>
  updateEdge<T extends Record<string, unknown> = Record<string, unknown>>(
    id: EdgeId,
    patch: BoardEdgePatch<T>,
  ): BoardEdge<T>
  deleteEdge(id: EdgeId): void
  getEdge(id: EdgeId): BoardEdge | undefined
  getEdges(): BoardEdge[]
  getEdgesFrom(id: NodeId): BoardEdge[]
  getEdgesTo(id: NodeId): BoardEdge[]
  getEdgesBetween(from: NodeId, to: NodeId): BoardEdge[]
}

/** Fully resolved endpoint used for rendering and hit-testing an edge. */
export interface ResolvedConnectionEndpoint {
  nodeId: NodeId
  node: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>
  side: AnchorSide
  offset: number
  point: Point
  kind: EndpointResolutionKind
}

/** Low-level path segment used to render a connection route. */
export type ConnectionRouteSegment =
  | { type: 'line'; from: Point; to: Point }
  | { type: 'cubic'; from: Point; control1: Point; control2: Point; to: Point }

/** Render-ready edge route including path data, bounds, and label position. */
export interface ConnectionRoute {
  routing: ConnectionRouting
  path: string
  labelPoint: Point
  bounds: Bounds
  waypoints: Point[]
  segments: ConnectionRouteSegment[]
}
