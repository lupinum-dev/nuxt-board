import { computed, watch, type ComputedRef, type Ref } from 'vue'
import type { BoardEngine, BoardSnapshot, GridSettings } from '@lupinum/board-core'
import { DEFAULT_BOARD_GRID_OPTIONS, type BoardGridOptions, type ResolvedBoardGridOptions } from '../grid'

export interface UseResolvedGridOptions {
  engine: BoardEngine
  snapshot: Ref<BoardSnapshot>
  gridProp: Ref<boolean | BoardGridOptions>
}

function resolveGridOptions(
  input: boolean | BoardGridOptions,
  engineGrid: GridSettings
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
      pattern: engineGrid.pattern
    }
  }

  const overrides = input === true ? {} : input

  return {
    visible: overrides.visible ?? DEFAULT_BOARD_GRID_OPTIONS.visible,
    size: overrides.size ?? engineGrid.size,
    majorEvery: overrides.majorEvery ?? engineGrid.majorEvery,
    snap: overrides.snap ?? engineGrid.snap,
    edgeSnap: overrides.edgeSnap ?? engineGrid.edgeSnap,
    edgeSnapThreshold: overrides.edgeSnapThreshold ?? engineGrid.edgeSnapThreshold,
    pattern: overrides.pattern ?? engineGrid.pattern,
    minorOpacity: overrides.minorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.minorOpacity,
    majorOpacity: overrides.majorOpacity ?? DEFAULT_BOARD_GRID_OPTIONS.majorOpacity,
    fadeEdges: overrides.fadeEdges ?? DEFAULT_BOARD_GRID_OPTIONS.fadeEdges
  }
}

export function useResolvedGrid(options: UseResolvedGridOptions): ComputedRef<ResolvedBoardGridOptions> {
  const resolvedGrid = computed(() => resolveGridOptions(options.gridProp.value, options.snapshot.value.grid))

  watch(
    options.gridProp,
    (value) => {
      if (value && typeof value === 'object') {
        const patch: Partial<GridSettings> = {}
        if (value.size !== undefined) patch.size = value.size
        if (value.majorEvery !== undefined) patch.majorEvery = value.majorEvery
        if (value.snap !== undefined) patch.snap = value.snap
        if (value.edgeSnap !== undefined) patch.edgeSnap = value.edgeSnap
        if (value.edgeSnapThreshold !== undefined) patch.edgeSnapThreshold = value.edgeSnapThreshold
        if (value.pattern !== undefined) patch.pattern = value.pattern
        if (Object.keys(patch).length > 0) {
          options.engine.updateGridSettings(patch)
        }
      }
    },
    { immediate: true, deep: true }
  )

  return resolvedGrid
}
