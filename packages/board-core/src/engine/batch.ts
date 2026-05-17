import type { BatchController } from '../subscribable'

interface BatchDeps {
  batchCtrl: BatchController
  emitCommandBefore: (name: string, args: unknown[]) => void
  emitCommandAfter: (name: string, args: unknown[], duration: number) => void
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
      deps.emitCommandBefore('batch', [])
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
    deps.emitCommandAfter('batch', [], performance.now() - startedAt)
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
