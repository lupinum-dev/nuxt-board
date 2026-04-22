import { validateState } from '../invariants'
import type {
  BoardState,
  GridSettings,
  InvariantFailure,
  InvariantMode,
  NodeTypeRegistry,
} from '../types'

export interface ValidationDeps<R extends NodeTypeRegistry> {
  invariantMode: InvariantMode
  getState: () => BoardState<R>
  getGrid: () => GridSettings
  emitFailure: (failure: InvariantFailure<R>) => void
}

export function createValidator<R extends NodeTypeRegistry>(
  deps: ValidationDeps<R>,
) {
  return function validate(context: string): void {
    if (deps.invariantMode === 'off') return
    const failures = validateState<R>(deps.getState(), deps.getGrid(), context)
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
