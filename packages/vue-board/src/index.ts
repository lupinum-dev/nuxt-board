import type { Component } from 'vue'
import './styles/theme.css'
import './styles/motion.css'

import BoardBoxSelectComponent from './components/BoardBoxSelect.vue'
import BoardGridComponent from './components/BoardGrid.vue'
import BoardNodeComponent from './components/BoardNode.vue'
import BoardNodeHandleComponent from './components/BoardNodeHandle.vue'
import BoardRootComponent from './components/BoardRoot.vue'
import BoardSelectionToolbarComponent from './components/BoardSelectionToolbar.vue'
import BoardSnapGuidesComponent from './components/BoardSnapGuides.vue'
import BoardViewportComponent from './components/BoardViewport.vue'

/** Main board root component that wires a board engine to the DOM scene graph. */
export const BoardRoot: Component = BoardRootComponent
/** Camera transform layer used inside `BoardRoot` render trees. */
export const BoardViewport: Component = BoardViewportComponent
/** Default node wrapper component used to position node renderers. */
export const BoardNode: Component = BoardNodeComponent
/** Resize handle component for interactive node resizing. */
export const BoardNodeHandle: Component = BoardNodeHandleComponent
/** Floating toolbar for selected nodes with remove, color, zoom, and edit actions. */
export const BoardSelectionToolbar: Component = BoardSelectionToolbarComponent
/** Node color presets and CSS variable resolver used by default and custom renderers. */
export {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  resolveNodeColorStyle,
  type BoardColorPreset,
} from './nodeColors.js'
/** Decorative grid overlay component. */
export const BoardGrid: Component = BoardGridComponent
/** Screen-space box selection overlay. */
export const BoardBoxSelect: Component = BoardBoxSelectComponent
/** Snap guide overlay rendered during drag and resize interactions. */
export const BoardSnapGuides: Component = BoardSnapGuidesComponent

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
