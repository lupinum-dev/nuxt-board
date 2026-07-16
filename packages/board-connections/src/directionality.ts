import type { EdgeEnd } from './types.js'

/** Arrow placement policy shared by connection defaults and editing commands. */
export type ConnectionDirectionality = 'none' | 'start' | 'end' | 'both'

/** Resolve a directionality choice to the persisted edge endpoint markers. */
export function edgeEndsForDirectionality(
  directionality: ConnectionDirectionality,
): { fromEnd: EdgeEnd; toEnd: EdgeEnd } {
  switch (directionality) {
    case 'start':
      return { fromEnd: 'arrow', toEnd: 'none' }
    case 'both':
      return { fromEnd: 'arrow', toEnd: 'arrow' }
    case 'none':
      return { fromEnd: 'none', toEnd: 'none' }
    case 'end':
      return { fromEnd: 'none', toEnd: 'arrow' }
  }
}
