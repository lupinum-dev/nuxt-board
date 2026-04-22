import type {
  BoardSnapshot,
  Camera,
  BoardEngine,
  BoardNode,
  InteractionState,
  NodeId,
  Point,
  SnapGuide,
} from '@lupinum/board-core'
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { BoardRendererRegistry, ResolvedBoardGridOptions } from './grid'

export interface BoardEngineContext {
  engine: BoardEngine
  /** @deprecated Use individual reactive refs ($camera, $nodes, etc.) instead. */
  snapshot: ShallowRef<BoardSnapshot>
  rootElement: Ref<HTMLElement | null>
  viewportSize: Ref<Point>
  renderers: Ref<BoardRendererRegistry>
  resolvedGrid: ComputedRef<ResolvedBoardGridOptions>
  toLocalPoint: (clientX: number, clientY: number) => Point
  // Granular reactive state from engine subscribables
  $camera: ShallowRef<Camera>
  $nodes: ShallowRef<ReadonlyMap<NodeId, BoardNode>>
  $selection: ShallowRef<ReadonlySet<NodeId>>
  $interaction: ShallowRef<InteractionState>
  $snapGuides: ShallowRef<readonly SnapGuide[]>
}

export const boardEngineKey: InjectionKey<BoardEngineContext> =
  Symbol('board-engine')
