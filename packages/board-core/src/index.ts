/** Create a headless board engine with commands and events. */
export { CommandBlockedError, createBoardEngine } from './engine'
/** Identifier branding helpers for nodes and edges. */
export { asEdgeId, asNodeId } from './types'
/** Shared Obsidian-compatible node color presets. */
export {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  isBoardColorPreset,
  type BoardColorOption,
} from './colors'
/** Selection helpers that operate on the public board engine state. */
export { getSelectionBounds, getSelectionNodes, toggleIds } from './selection'

/** Geometry helpers used by renderers and framework adapters. */
export {
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
} from './math'

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
  NuxtBoardDocumentMetadata,
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
} from './types'
