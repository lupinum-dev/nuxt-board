import type { Subscribable, Unsubscribe } from './types'

// Batch coordination — shared across all subscribables in an engine
export interface BatchController {
  depth: number
  pending: Set<() => void>
}

export function createBatchController(): BatchController {
  return { depth: 0, pending: new Set() }
}

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
