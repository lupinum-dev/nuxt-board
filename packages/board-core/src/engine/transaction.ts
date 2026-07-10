import { cloneInteraction } from '../invariants.js'
import type { MutableBoardState } from '../state/types.js'
import type { GridSettings } from '../types.js'

export type MutablePluginStates = Map<string, { state: unknown }>

export interface PersistentRoots {
  state: MutableBoardState
  grid: GridSettings
  pluginStates: MutablePluginStates
}

/**
 * Create an isolated candidate for one outer persistent command.
 * Node records and plugin slices remain shared until a command replaces them.
 */
export function stagePersistentRoots(roots: PersistentRoots): PersistentRoots {
  return {
    state: {
      camera: { ...roots.state.camera },
      nodes: new Map(roots.state.nodes),
      selection: new Set(roots.state.selection),
      interaction: cloneInteraction(roots.state.interaction),
      snapGuides: roots.state.snapGuides.map((guide) => ({ ...guide })),
      nextZIndex: roots.state.nextZIndex,
    },
    grid: { ...roots.grid },
    pluginStates: new Map(
      Array.from(roots.pluginStates, ([name, pluginState]) => [
        name,
        { state: pluginState.state },
      ]),
    ),
  }
}
