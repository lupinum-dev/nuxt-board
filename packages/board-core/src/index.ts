/** Create a headless board engine with commands, events, and first-party feature hooks. */
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
/** @internal First-party feature action stream. Not a public plugin API. */
export type {
  Action as FirstPartyBoardAction,
  NodeMoveDelta as FirstPartyNodeMoveDelta,
} from './state/actions'

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
  BoardNode,
  EdgeId,
  GridPattern,
  GridSettings,
  InteractionMode,
  InteractionState,
  ValidationFailure,
  ValidationMode,
  FirstPartyBoardFeature,
  FirstPartyBoardFeatureContext,
  FirstPartyBoardFeaturePersistence,
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
  NuxtBoardEdgeMetadata,
  NuxtBoardNodeMetadata,
  NodePatch,
  Point,
  ResizeHandle,
  SelectionMode,
  SnapAxis,
  SnapGuide,
  Subscribable,
  TraceEntry,
  Unsubscribe,
  ZoomSettings,
} from './types'
