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
export { buildArcRoute } from './routing/arc'
export type { ArcOptions } from './routing/arc'
export {
  EDGE_COLOR_PRESETS,
  colorForPreset,
  presetForColor,
  resolvePresetColor
} from './colors'
export type { EdgeColorOption, EdgeColorPreset } from './colors'
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
