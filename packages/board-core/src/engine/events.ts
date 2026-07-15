import type {
  BoardEventMap,
  BoardUnhandledErrorContext,
  TraceEntry,
} from '../types.js'
import type { ListenerMap } from '../state/types.js'

interface EventBusOptions {
  diagnosticsEnabled: boolean
  traceLimit: number
  onUnhandledError?: (
    error: unknown,
    context: BoardUnhandledErrorContext,
  ) => void
}

interface EventBus {
  emit<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ): void
  emitImmediate<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ): void
  on<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ): () => void
  once<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ): () => void
  off<K extends keyof BoardEventMap>(event: K, handler: BoardEventMap[K]): void
  exportTrace(): TraceEntry[]
  beginTransaction(): void
  commitTransaction(): void
  rollbackTransaction(): void
  reportUnhandledError(
    error: unknown,
    context: BoardUnhandledErrorContext,
  ): void
  clear(): void
}

export function createEventBus(opts: EventBusOptions): EventBus {
  const listeners: ListenerMap = new Map()
  const trace: Array<{
    event: string
    timestamp: number
    args: unknown[]
  }> = []
  const queuedEvents: Array<{
    event: keyof BoardEventMap
    args: unknown[]
  }> = []
  let transactionDepth = 0

  function reportUnhandledError(
    error: unknown,
    context: BoardUnhandledErrorContext,
  ): void {
    if (opts.onUnhandledError) {
      try {
        opts.onUnhandledError(error, context)
      } catch (reportingError) {
        console.error(
          `[board] onUnhandledError failed while reporting ${context.source}:`,
          reportingError,
        )
      }
      return
    }
    const subject =
      context.source === 'event-listener'
        ? `handler for "${context.event}"`
        : context.source === 'subscriber'
          ? `subscriber for "${context.channel}"`
          : `commit effect for "${context.commit}"`
    console.error(`[board] ${subject} threw:`, error)
  }

  function emit<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ): void {
    if (transactionDepth > 0) {
      queuedEvents.push({ event, args })
      return
    }
    publish(event, args)
  }

  function publish<K extends keyof BoardEventMap>(
    event: K,
    args: Parameters<BoardEventMap[K]>,
  ): void {
    if (opts.diagnosticsEnabled) {
      trace.push({ event: String(event), timestamp: Date.now(), args })
      if (trace.length > opts.traceLimit) {
        trace.shift()
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      try {
        ;(handler as (...payload: Parameters<BoardEventMap[K]>) => void)(
          ...args,
        )
      } catch (error) {
        reportUnhandledError(error, {
          source: 'event-listener',
          event: String(event),
        })
      }
    }
  }

  function emitImmediate<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
  ): void {
    publish(event, args)
  }

  function on<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ) {
    const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
    set.add(handler as (...args: unknown[]) => void)
    listeners.set(event, set)
    return () => off(event, handler)
  }

  function once<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ) {
    const unsubscribe = on(event, ((...args: unknown[]) => {
      unsubscribe()
      ;(handler as (...payload: unknown[]) => void)(...args)
    }) as BoardEventMap[K])
    return unsubscribe
  }

  function off<K extends keyof BoardEventMap>(
    event: K,
    handler: BoardEventMap[K],
  ): void {
    listeners.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  function exportTrace(): TraceEntry[] {
    return trace.map((entry) =>
      Object.freeze({
        ...entry,
        args: Object.freeze([...entry.args]),
      }),
    )
  }

  function clear(): void {
    listeners.clear()
    trace.length = 0
    queuedEvents.length = 0
    transactionDepth = 0
  }

  function beginTransaction(): void {
    transactionDepth += 1
  }

  function commitTransaction(): void {
    if (transactionDepth === 0) return
    transactionDepth -= 1
    if (transactionDepth !== 0) return
    const events = queuedEvents.splice(0)
    for (const entry of events) {
      publishQueued(entry)
    }
  }

  function publishQueued(entry: {
    event: keyof BoardEventMap
    args: unknown[]
  }): void {
    publish(
      entry.event,
      entry.args as Parameters<BoardEventMap[typeof entry.event]>,
    )
  }

  function rollbackTransaction(): void {
    if (transactionDepth === 0) return
    transactionDepth -= 1
    if (transactionDepth === 0) {
      queuedEvents.length = 0
    }
  }

  return {
    emit,
    emitImmediate,
    on,
    once,
    off,
    exportTrace,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    reportUnhandledError,
    clear,
  }
}
