import type { BoardEventMap, TraceEntry } from '../types.js'
import type { ListenerMap } from '../state/types.js'

interface EventBusOptions {
  diagnosticsEnabled: boolean
  traceLimit: number
}

interface EventBus {
  emit<K extends keyof BoardEventMap>(
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
  clear(): void
}

export function createEventBus(opts: EventBusOptions): EventBus {
  const listeners: ListenerMap = new Map()
  const trace: TraceEntry[] = []

  function emit<K extends keyof BoardEventMap>(
    event: K,
    ...args: Parameters<BoardEventMap[K]>
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
        console.error(`[board] handler for "${String(event)}" threw:`, error)
      }
    }
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
    return trace.slice()
  }

  function clear(): void {
    listeners.clear()
    trace.length = 0
  }

  return { emit, on, once, off, exportTrace, clear }
}
