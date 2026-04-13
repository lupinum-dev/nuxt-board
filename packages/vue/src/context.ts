import type { BoardSnapshot, Camera, CanvasEngine, CanvasNode, InteractionState, NodeId, Point, SnapGuide } from '@canvas/core'
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { CanvasRendererRegistry, ResolvedCanvasGridOptions } from './grid'

export interface CanvasEngineContext {
  engine: CanvasEngine
  /** @deprecated Use individual reactive refs ($camera, $nodes, etc.) instead. */
  snapshot: ShallowRef<BoardSnapshot>
  rootElement: Ref<HTMLElement | null>
  viewportSize: Ref<Point>
  renderers: Ref<CanvasRendererRegistry>
  resolvedGrid: ComputedRef<ResolvedCanvasGridOptions>
  toLocalPoint: (clientX: number, clientY: number) => Point
  // Granular reactive state from engine subscribables
  $camera: ShallowRef<Camera>
  $nodes: ShallowRef<ReadonlyMap<NodeId, CanvasNode>>
  $selection: ShallowRef<ReadonlySet<NodeId>>
  $interaction: ShallowRef<InteractionState>
  $snapGuides: ShallowRef<readonly SnapGuide[]>
}

export const canvasEngineKey: InjectionKey<CanvasEngineContext> = Symbol('canvas-engine')
