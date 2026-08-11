import { computed, type ComputedRef, type Ref } from 'vue'
import type { GridSettings } from '@lupinum/board-core'
import {
  DEFAULT_BOARD_GRID_OPTIONS,
  type BoardGridOptions,
  type ResolvedBoardGridOptions,
} from '../grid.js'

/** Inputs used to merge the `BoardRoot` grid prop with engine grid state. */
interface UseResolvedGridOptions {
  grid: Ref<GridSettings>
  gridProp: Ref<boolean | BoardGridOptions>
}

function resolveGridOptions(
  input: boolean | BoardGridOptions,
  engineGrid: GridSettings,
): ResolvedBoardGridOptions {
  if (input === false) {
    return {
      ...DEFAULT_BOARD_GRID_OPTIONS,
      visible: false,
      size: engineGrid.size,
      majorEvery: engineGrid.majorEvery,
      snap: engineGrid.snap,
      edgeSnap: engineGrid.edgeSnap,
      edgeSnapThreshold: engineGrid.edgeSnapThreshold,
      pattern: engineGrid.pattern,
    }
  }

  const overrides = input === true ? {} : input

  return {
    visible: overrides.visible ?? DEFAULT_BOARD_GRID_OPTIONS.visible,
    size: engineGrid.size,
    majorEvery: engineGrid.majorEvery,
    snap: engineGrid.snap,
    edgeSnap: engineGrid.edgeSnap,
    edgeSnapThreshold: engineGrid.edgeSnapThreshold,
    pattern: engineGrid.pattern,
    minorOpacity:
      overrides.minorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.minorOpacity,
    majorOpacity:
      overrides.majorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.majorOpacity,
    fadeEdges: overrides.fadeEdges ?? DEFAULT_BOARD_GRID_OPTIONS.fadeEdges,
  }
}

/**
 * Resolve the effective grid configuration for rendering and keep the engine
 * grid state in sync with explicit prop overrides.
 */
export function useResolvedGrid(
  options: UseResolvedGridOptions,
): ComputedRef<ResolvedBoardGridOptions> {
  return computed(() =>
    resolveGridOptions(options.gridProp.value, options.grid.value),
  )
}
