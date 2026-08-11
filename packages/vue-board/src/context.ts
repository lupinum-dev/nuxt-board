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
  rootElement: Readonly<Ref<HTMLElement | null>>
  viewportSize: Readonly<Ref<Point>>
  renderers: Readonly<ShallowRef<Readonly<BoardRendererRegistry>>>
  resolvedGrid: ComputedRef<ResolvedBoardGridOptions>
  toLocalPoint: (clientX: number, clientY: number) => Point
  // Granular reactive state from engine subscribables
  $camera: Readonly<ShallowRef<Camera>>
  $grid: Readonly<ShallowRef<GridSettings>>
  $nodes: Readonly<ShallowRef<ReadonlyMap<NodeId, BoardNode>>>
  $selection: Readonly<ShallowRef<ReadonlySet<NodeId>>>
  $interaction: Readonly<ShallowRef<InteractionState>>
  $snapGuides: Readonly<ShallowRef<readonly SnapGuide[]>>
}

export const boardEngineKey: InjectionKey<BoardEngineContext> =
  Symbol('board-engine')
