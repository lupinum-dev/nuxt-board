import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { CanvasDiagnosticsEvent, CanvasEngine, CanvasEngineSnapshot, Point } from '@canvas/core'

export interface CanvasRenderStats {
  visibleNodeCount: Ref<number>
  renderCount: Ref<number>
  lastPerformanceSample: Ref<CanvasDiagnosticsEvent | null>
  lastInvariantFailure: Ref<CanvasDiagnosticsEvent | null>
  incrementRenderCount: () => void
  setVisibleNodeCount: (count: number) => void
  consumeEvent: (event: CanvasDiagnosticsEvent) => void
}

export interface CanvasEngineContext {
  engine: CanvasEngine
  snapshot: ShallowRef<CanvasEngineSnapshot>
  viewportSize: Ref<Point>
  renderStats: CanvasRenderStats
}

export const canvasEngineKey: InjectionKey<CanvasEngineContext> = Symbol('canvas-engine')
