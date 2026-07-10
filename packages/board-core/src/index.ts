/** Create a headless board engine with commands and events. */
export { CommandBlockedError, createBoardEngine } from './engine.js'
/** Stable error classes surfaced by public engine boundaries. */
export {
  BoardConflictError,
  BoardDestroyedError,
  BoardError,
  BoardInputError,
  BoardNotFoundError,
} from './errors.js'
/** Identifier branding helpers for nodes and edges. */
export { asEdgeId, asNodeId } from './types.js'
/** Shared Obsidian-compatible node color presets. */
export {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  isBoardColorPreset,
  type BoardColorOption,
} from './colors.js'
/** Selection helpers that operate on the public board engine state. */
export {
  getSelectionBounds,
  getSelectionNodes,
  toggleIds,
} from './selection.js'

/** Geometry helpers used by renderers and framework adapters. */
export {
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
} from './math.js'

/** Core engine, document, geometry, and node model types. */
export type {
  BoxSelectBehavior,
  BoxSelectMode,
  BoxSelectSettings,
  BoardColorPreset,
  BoardSnapshot,
  BoardState,
  Bounds,
  Camera,
  CanvasColor,
  BoardEngine,
  BoardEngineOptions,
  BoardEventMap,
  BoardExtension,
  BoardNode,
  EdgeId,
  DuplicateNodesResult,
  GridPattern,
  GridSettings,
  InteractionMode,
  InteractionState,
  ValidationFailure,
  ValidationMode,
  BoardFeatureExtensions,
  JsonCanvasBackgroundStyle,
  JsonCanvasDocument,
  JsonCanvasEdge,
  JsonCanvasEdgeEnd,
  JsonCanvasFileNode,
  JsonCanvasGroupNode,
  JsonCanvasLinkNode,
  JsonCanvasNode,
  JsonCanvasNodeType,
  JsonCanvasSide,
  JsonCanvasTextNode,
  NodeConstraints,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  ResizeHandle,
  SelectionMode,
  SnapAxis,
  SnapGuide,
  Subscribable,
  TraceEntry,
  Unsubscribe,
  VueBoardDocumentMetadata,
  VueBoardEdgeMetadata,
  VueBoardNodeMetadata,
  ZoomSettings,
} from './types.js'
