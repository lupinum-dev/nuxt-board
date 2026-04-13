export { connectionPlugin } from './plugin'
export { BoardConnectionLayer } from './layer'
export {
  buildConnectionRoute,
  getVisibleEdges,
  resolveAnchorPoint,
  resolveAutoAnchorSide,
  resolveConnectionEndpoint,
  resolveFloatingEndpoint,
  resolveEdgeRenderState
} from './geometry'
export type {
  AnchorPosition,
  AnchorSide,
  BoardEdge,
  BoardEdgePatch,
  ConnectionPluginOptions,
  ConnectionRoute,
  ConnectionRouteSegment,
  ConnectionRouting,
  ConnectionsExtension,
  EdgeEnd,
  ResolvedConnectionEndpoint
} from './types'
