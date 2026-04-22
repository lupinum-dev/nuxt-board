/** Create a headless board engine with commands, events, and plugin hooks. */
export { createBoardEngine } from './engine'
/** Reactive primitives used internally by the engine and reusable in host adapters. */
export { createBatchController, createSubscribable } from './subscribable'
/** Type for the batch controller used by engine subscribables. */
export type { BatchController } from './subscribable'
/** Identifier branding helpers for nodes and edges. */
export { asEdgeId, asNodeId } from './types'
/** Low-level action types emitted by reducer-backed commands. */
export type { Action, NodeMoveDelta } from './state/actions'

/** Hierarchy helpers for grouping, subtree traversal, and drag target expansion. */
export {
  addDescendants,
  collectSubtreeIds,
  collectUniformTranslationTargets,
  expandGroupDragSeeds,
  findContainingGroup,
  getBoundsFromNode,
  groupArea,
  isStrictDescendantOf,
  sortIdsByZIndex,
} from './hierarchy'

/** Math helpers for bounds, viewport transforms, interpolation, and grid snapping. */
export {
  boundsContain,
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
  lerp,
  lerpCamera,
  pointInBounds,
  screenToWorld,
  snapBounds,
  snapPoint,
  snapSize,
  snapValue,
  worldToScreen,
  zoomCameraAtScreenPoint,
} from './math'

/** Resize helpers for drag handles, aspect-ratio locks, and snapping. */
export {
  applyResizeDelta,
  applyResizeDeltaLocked,
  snapResizedBounds,
  snapResizedBoundsLocked,
} from './resize'

/** Edge-snapping helpers used during move and resize interactions. */
export {
  collectNodeEdges,
  snapBoundsToEdges,
  snapPositionToEdges,
} from './snap'

/** Core engine, snapshot, geometry, plugin, and node model types. */
export type {
  BoxSelectBehavior,
  BoxSelectMode,
  BoxSelectSettings,
  BoardSnapshot,
  BoardState,
  Bounds,
  Camera,
  BoardEngine,
  BoardEngineOptions,
  BoardEngineExtensions,
  BoardEventMap,
  BoardNode,
  BoardPlugin,
  BoardPluginContext,
  EdgeId,
  GridPattern,
  GridSettings,
  InteractionMode,
  InteractionState,
  InvariantFailure,
  InvariantMode,
  NodeConstraints,
  NodeData,
  NodeId,
  NodeInput,
  NodeTypeRegistry,
  NodePatch,
  PluginCleanup,
  Point,
  ResolvedNode,
  ResizeHandle,
  SelectionMode,
  SnapAxis,
  SnapGuide,
  Subscribable,
  TraceEntry,
  Unsubscribe,
  ZoomSettings,
} from './types'

/** Result types returned by edge-snapping helpers. */
export type { SnapResult, DragSnapResult } from './snap'
