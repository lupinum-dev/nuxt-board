import { validateState } from '../invariants.js'
import { BoardInputError } from '../errors.js'
import type { BatchController } from '../subscribable.js'
import type {
  BoardState,
  CommandGuard,
  CommandMetadata,
  GridSettings,
  ValidationFailure,
} from '../types.js'

const BATCH_COMMAND_METADATA: CommandMetadata = {
  history: 'record',
}

interface CommandGuardRegistry {
  add(fn: CommandGuard): () => void
  run(name: string, args: unknown[], metadata: CommandMetadata): string | null
  clear(): void
}

interface BatchDeps {
  batchCtrl: BatchController
  emitCommandBefore: (
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ) => void
  emitCommandAfter: (
    name: string,
    args: unknown[],
    duration: number,
    metadata: CommandMetadata,
  ) => void
  validate: (context: string) => void
}

interface BatchCommandController {
  isBatching(): boolean
  markValidationPending(): void
  begin(): void
  end(): void
  batch(fn: () => void): void
  flushBatchNotifications(): void
  rollbackBatchNotifications(): void
}

interface ValidationDeps {
  getState: () => BoardState
  getGrid: () => GridSettings
  emitFailure: (failure: ValidationFailure) => void
}

export function createCommandGuardRegistry(): CommandGuardRegistry {
  const guards: CommandGuard[] = []

  function add(fn: CommandGuard): () => void {
    guards.push(fn)
    return () => {
      const index = guards.indexOf(fn)
      if (index !== -1) guards.splice(index, 1)
    }
  }

  function run(
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ): string | null {
    const command = Object.freeze({
      name,
      args: Object.freeze([...args]),
      metadata: Object.freeze({ ...metadata }),
    })
    for (const guard of guards) {
      const result = guard(command)
      if (result !== true) {
        return result
      }
    }
    return null
  }

  return {
    add,
    run,
    clear: () => {
      guards.length = 0
    },
  }
}

export function createValidator(deps: ValidationDeps) {
  return function validate(context: string): void {
    const failures = validateState(deps.getState(), deps.getGrid(), context)
    for (const failure of failures) {
      deps.emitFailure(failure)
    }
    if (failures.length > 0) {
      throw new BoardInputError(
        `Board validation failed in ${context}: ${failures[0]?.message}`,
      )
    }
  }
}

export function createBatchCommandController(
  deps: BatchDeps,
): BatchCommandController {
  let depth = 0
  let startedAt = 0
  let validationPending = false

  function flushBatchNotifications(): void {
    const pending = [...deps.batchCtrl.pending]
    deps.batchCtrl.pending.clear()
    deps.batchCtrl.rollbacks.clear()
    for (const flush of pending) flush()
  }

  function rollbackBatchNotifications(): void {
    const rollbacks = [...deps.batchCtrl.rollbacks]
    deps.batchCtrl.pending.clear()
    deps.batchCtrl.rollbacks.clear()
    for (const rollback of rollbacks) rollback()
  }

  function begin(): void {
    if (depth === 0) {
      startedAt = performance.now()
      deps.batchCtrl.depth += 1
      deps.emitCommandBefore('batch', [], BATCH_COMMAND_METADATA)
    }
    depth += 1
  }

  function end(): void {
    depth -= 1
    if (depth !== 0) return
    try {
      if (validationPending) {
        deps.validate('batch')
      }
      deps.batchCtrl.depth -= 1
      flushBatchNotifications()
    } catch (error) {
      deps.batchCtrl.depth -= 1
      rollbackBatchNotifications()
      throw error
    } finally {
      validationPending = false
    }
    deps.emitCommandAfter(
      'batch',
      [],
      performance.now() - startedAt,
      BATCH_COMMAND_METADATA,
    )
  }

  function batch(fn: () => void): void {
    begin()
    try {
      fn()
    } catch (error) {
      depth -= 1
      if (depth === 0) {
        validationPending = false
        deps.batchCtrl.depth -= 1
        rollbackBatchNotifications()
      }
      throw error
    }
    end()
  }

  return {
    isBatching: () => depth > 0,
    markValidationPending: () => {
      validationPending = true
    },
    begin,
    end,
    batch,
    flushBatchNotifications,
    rollbackBatchNotifications,
  }
}
