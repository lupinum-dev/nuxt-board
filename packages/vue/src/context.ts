import type { BoardSnapshot, CanvasEngine, Point } from '@canvas/core'
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { CanvasRendererRegistry, ResolvedCanvasGridOptions } from './grid'

export interface CanvasEngineContext {
  engine: CanvasEngine
  snapshot: ShallowRef<BoardSnapshot>
  rootElement: Ref<HTMLElement | null>
  viewportSize: Ref<Point>
  renderers: Ref<CanvasRendererRegistry>
  resolvedGrid: ComputedRef<ResolvedCanvasGridOptions>
  renderCount: Ref<number>
  toLocalPoint: (clientX: number, clientY: number) => Point
}

export const canvasEngineKey: InjectionKey<CanvasEngineContext> = Symbol('canvas-engine')
