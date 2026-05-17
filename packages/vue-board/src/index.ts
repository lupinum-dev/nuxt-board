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
} from './nodeColors'
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
} from './grid'

/** Injection context returned by `useBoardEngine`. */
export type { BoardEngineContext } from './context'

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
} from './useBoardEngine'

/** Observe the rendered board viewport size and sync it into the engine. */
export { useViewportSize } from './composables/useViewportSize'
/** Merge grid props with persistent engine grid settings. */
export { useResolvedGrid } from './composables/useResolvedGrid'

/** Viewport culling and level-of-detail helpers for large boards. */
export {
  useLodCulling,
  type LodNode,
  type NodeLod,
} from './composables/useLodCulling'

/** Keyboard shortcut handlers used by `BoardRoot` or custom root components. */
export { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'
/** Pointer gesture translation used by `BoardRoot` or custom root components. */
export { usePointerInteraction } from './composables/usePointerInteraction'
