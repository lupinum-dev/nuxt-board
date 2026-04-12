export interface CanvasGridOptions {
  visible?: boolean
  size?: number
  majorEvery?: number
  snap?: boolean
  minorOpacity?: number
  majorOpacity?: number
  fadeEdges?: boolean
}

export interface ResolvedCanvasGridOptions {
  visible: boolean
  size: number
  majorEvery: number
  snap: boolean
  minorOpacity: number
  majorOpacity: number
  fadeEdges: boolean
}

export const DEFAULT_CANVAS_GRID_OPTIONS: Pick<
  ResolvedCanvasGridOptions,
  'visible' | 'minorOpacity' | 'majorOpacity' | 'fadeEdges'
> = {
  visible: true,
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: true
}
