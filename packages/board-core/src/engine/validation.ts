import { validateState } from '../invariants'
import type {
  BoardState,
  GridSettings,
  ValidationFailure,
  ValidationMode,
} from '../types'

interface ValidationDeps {
  validationMode: ValidationMode
  getState: () => BoardState
  getGrid: () => GridSettings
  emitFailure: (failure: ValidationFailure) => void
}

export function createValidator(deps: ValidationDeps) {
  return function validate(context: string): void {
    if (deps.validationMode === 'off') return
    const failures = validateState(deps.getState(), deps.getGrid(), context)
    for (const failure of failures) {
      deps.emitFailure(failure)
    }
    if (failures.length > 0 && deps.validationMode === 'strict') {
      throw new Error(
        `Board validation failed in ${context}: ${failures[0]?.message}`,
      )
    }
  }
}
