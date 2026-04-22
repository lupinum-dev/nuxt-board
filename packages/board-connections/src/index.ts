/** Install the connections plugin and its `engine.ext.connections` extension. */
export { connectionPlugin } from './plugin'
/** SVG layer that renders edges, labels, handles, and connection previews. */
export { BoardConnectionLayer } from './layer'

/** Geometry helpers for resolving anchors, routes, and render state. */
export {
  buildConnectionRoute,
  getVisibleEdges,
  resolveAnchorPoint,
  resolveAutoAnchorSide,
  resolveConnectionEndpoint,
  resolveFloatingEndpoint,
  resolveEdgeRenderState,
} from './geometry'

/** Arc routing helper inspired by hand-drawn arrow curves. */
export { buildArcRoute } from './routing/arc'
/** Options for tuning arc routing curvature. */
export type { ArcOptions } from './routing/arc'

/** Color helpers and presets used by edge rendering and toolbars. */
export {
  EDGE_COLOR_PRESETS,
  colorForPreset,
  presetForColor,
  resolvePresetColor,
} from './colors'
/** Types for custom edge colors and preset names. */
export type { EdgeColorOption, EdgeColorPreset } from './colors'

/** Core edge model types and the connections engine extension contract. */
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
  ResolvedConnectionEndpoint,
} from './types'
