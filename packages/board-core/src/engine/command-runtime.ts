import { validateState } from '../invariants'
import type { BatchController } from '../subscribable'
import type { Action } from '../state/actions'
import type {
  BoardState,
  CommandGuard,
  CommandMetadata,
  GridSettings,
  ValidationFailure,
  ValidationMode,
} from '../types'

const BATCH_COMMAND_METADATA: CommandMetadata = {
  history: 'record',
}

type ActionListener = (action: Action) => void

interface Dispatcher {
  dispatch(action: Action): void
  onAction(listener: ActionListener): () => void
}

interface CommandGuardRegistry {
  add(fn: CommandGuard): () => void
  run(name: string, args: unknown[]): boolean
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
}

interface ValidationDeps {
  validationMode: ValidationMode
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

  function run(name: string, args: unknown[]): boolean {
    if (guards.length === 0) return true
    let proceeded = false
    let i = 0
    function step(): void {
      const guard = guards[i++]
      if (guard) {
        guard(name, args, step)
      } else {
        proceeded = true
      }
    }
    step()
    return proceeded
  }

  return { add, run }
}

export function createDispatcher(): Dispatcher {
  const listeners = new Set<ActionListener>()

  function dispatch(action: Action): void {
    for (const listener of listeners) {
      try {
        listener(action)
      } catch (error) {
        console.error('[board] action listener threw:', error)
      }
    }
  }

  function onAction(listener: ActionListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    dispatch,
    onAction,
  }
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

export function createBatchCommandController(
  deps: BatchDeps,
): BatchCommandController {
  let depth = 0
  let startedAt = 0
  let validationPending = false

  function flushBatchNotifications(): void {
    const pending = [...deps.batchCtrl.pending]
    deps.batchCtrl.pending.clear()
    for (const flush of pending) flush()
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
    } finally {
      validationPending = false
      deps.batchCtrl.depth -= 1
      flushBatchNotifications()
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
    } finally {
      end()
    }
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
  }
}
