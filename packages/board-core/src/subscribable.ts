import type { Subscribable, Unsubscribe } from './types'

/** Batch coordination shared across the subscribables owned by one engine instance. */
export interface BatchController {
  depth: number
  pending: Set<() => void>
}

/** Create a batch controller that defers subscriber notifications until the batch completes. */
export function createBatchController(): BatchController {
  return { depth: 0, pending: new Set() }
}

/**
 * Create a mutable subscribable value.
 *
 * The returned object implements the public `Subscribable<T>` contract plus
 * `set()` and `notify()` helpers used by the engine internals.
 */
export function createSubscribable<T>(
  initial: T,
  batch: BatchController,
): Subscribable<T> & {
  set(value: T): void
  notify(): void
} {
  let current = initial
  let prev = initial
  const listeners = new Set<(value: T, prev: T) => void>()

  function notify(): void {
    if (batch.depth > 0) {
      batch.pending.add(flush)
      return
    }
    flush()
  }

  function flush(): void {
    const snapshot = current
    const prevSnapshot = prev
    prev = current
    for (const fn of listeners) {
      fn(snapshot, prevSnapshot)
    }
  }

  return {
    get(): T {
      return current
    },

    set(value: T): void {
      prev = current
      current = value
      notify()
    },

    subscribe(callback: (value: T, prev: T) => void): Unsubscribe {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },

    notify,
  }
}
