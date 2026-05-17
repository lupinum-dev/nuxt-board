import { validateState } from '../invariants'
import type {
  BoardState,
  GridSettings,
  InvariantFailure,
  InvariantMode,
} from '../types'

interface ValidationDeps {
  invariantMode: InvariantMode
  getState: () => BoardState
  getGrid: () => GridSettings
  emitFailure: (failure: InvariantFailure) => void
}

export function createValidator(deps: ValidationDeps) {
  return function validate(context: string): void {
    if (deps.invariantMode === 'off') return
    const failures = validateState(deps.getState(), deps.getGrid(), context)
    for (const failure of failures) {
      deps.emitFailure(failure)
    }
    if (failures.length > 0 && deps.invariantMode === 'strict') {
      throw new Error(
        `Board invariant failed in ${context}: ${failures[0]?.message}`,
      )
    }
  }
}
