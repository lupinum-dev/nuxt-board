import type {
  Camera,
  BoardEngine,
  BoardNode,
  GridSettings,
  InteractionState,
  NodeId,
  Point,
  SnapGuide,
} from '@lupinum/board-core'
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { BoardRendererRegistry, ResolvedBoardGridOptions } from './grid.js'

export interface BoardEngineContext {
  engine: BoardEngine
  rootElement: Ref<HTMLElement | null>
  viewportSize: Ref<Point>
  renderers: Ref<BoardRendererRegistry>
  resolvedGrid: ComputedRef<ResolvedBoardGridOptions>
  toLocalPoint: (clientX: number, clientY: number) => Point
  // Granular reactive state from engine subscribables
  $camera: ShallowRef<Camera>
  $grid: ShallowRef<GridSettings>
  $nodes: ShallowRef<ReadonlyMap<NodeId, BoardNode>>
  $selection: ShallowRef<ReadonlySet<NodeId>>
  $interaction: ShallowRef<InteractionState>
  $snapGuides: ShallowRef<readonly SnapGuide[]>
}

export const boardEngineKey: InjectionKey<BoardEngineContext> =
  Symbol('board-engine')
