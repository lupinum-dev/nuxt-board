import './styles/theme.css'
import './styles/motion.css'

/** Main board root component that wires a board engine to the DOM scene graph. */
export { default as BoardRoot } from './components/BoardRoot.vue'
/** Camera transform layer used inside `BoardRoot` render trees. */
export { default as BoardViewport } from './components/BoardViewport.vue'
/** Default node wrapper component used to position node renderers. */
export { default as BoardNode } from './components/BoardNode.vue'
/** Resize handle component for interactive node resizing. */
export { default as BoardNodeHandle } from './components/BoardNodeHandle.vue'
/** Floating toolbar for selected nodes with remove, color, zoom, and edit actions. */
export { default as BoardSelectionToolbar } from './components/BoardSelectionToolbar.vue'
/** Node color presets and CSS variable resolver used by default and custom renderers. */
export {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  resolveNodeColorStyle,
  type BoardColorPreset,
} from './nodeColors.js'
/** Decorative grid overlay component. */
export { default as BoardGrid } from './components/BoardGrid.vue'
/** Screen-space box selection overlay. */
export { default as BoardBoxSelect } from './components/BoardBoxSelect.vue'
/** Snap guide overlay rendered during drag and resize interactions. */
export { default as BoardSnapGuides } from './components/BoardSnapGuides.vue'

/** Types for configuring the board grid renderer. */
export type {
  BoardGridOptions,
  BoardRendererRegistry,
  ResolvedBoardGridOptions,
} from './grid.js'

/** Injection context returned by `useBoardEngine`. */
export type { BoardEngineContext } from './context.js'

/** Core board context composables for camera, nodes, selection, and node actions. */
export {
  useBoardEngine,
  useCamera,
  useNodes,
  useSelection,
  useInteraction,
  useVisibleBounds,
  useVisibleNodes,
  useGridStyle,
  useNode,
  useBoxSelectBounds,
} from './useBoardEngine.js'
