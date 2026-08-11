import type { Component } from 'vue'
import type { GridPattern, JsonCanvasNodeType } from '@lupinum/board-core'

export interface BoardGridOptions {
  visible?: boolean
  minorOpacity?: number
  majorOpacity?: number
  fadeEdges?: boolean
}

export interface ResolvedBoardGridOptions {
  visible: boolean
  size: number
  majorEvery: number
  snap: boolean
  edgeSnap: boolean
  edgeSnapThreshold: number
  pattern: GridPattern
  minorOpacity: number
  majorOpacity: number
  fadeEdges: boolean
}

export type BoardRendererRegistry = Partial<
  Record<JsonCanvasNodeType, Component>
>

export const DEFAULT_BOARD_GRID_OPTIONS: Pick<
  ResolvedBoardGridOptions,
  'visible' | 'minorOpacity' | 'majorOpacity' | 'fadeEdges'
> = {
  visible: true,
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: true,
}
