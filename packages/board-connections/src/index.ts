/** Install the connections plugin and its `engine.plugins.connections` API. */
export { connectionsPlugin } from './plugin.js'
/** SVG layer that renders edges, labels, handles, and connection previews. */
export { BoardConnectionLayer } from './layer.js'

/** Geometry helpers for resolving anchors, routes, and render state. */
export {
  buildConnectionRoute,
  getVisibleEdges,
  resolveAnchorPoint,
  resolveAutoAnchorSide,
  resolveConnectionEndpoint,
  resolveFloatingEndpoint,
  resolveEdgeRenderState,
} from './geometry.js'

/** Arc routing helper inspired by hand-drawn arrow curves. */
export { buildArcRoute } from './routing/arc.js'
/** Options for tuning arc routing curvature. */
export type { ArcOptions } from './routing/arc.js'

/** Color helpers and presets used by edge rendering and toolbars. */
export {
  EDGE_COLOR_PRESETS,
  colorForPreset,
  presetForColor,
  resolvePresetColor,
} from './colors.js'
/** Types for custom edge colors and preset names. */
export type { EdgeColorOption, EdgeColorPreset } from './colors.js'

/** Core edge model types and the connections engine API contract. */
export type {
  AnchorPosition,
  AnchorSide,
  BoardEdge,
  BoardEdgePatch,
  ConnectionConfig,
  ConnectionEndpointMode,
  ConnectionPluginOptions,
  ConnectionRoute,
  ConnectionRouteSegment,
  ConnectionRouting,
  ConnectionsApi,
  CreateNodeForConnectionContext,
  EdgeEnd,
  ResolvedConnectionEndpoint,
} from './types.js'
