import type { BoardEventMap, NodeTypeRegistry, TraceEntry } from '../types'
import type { ListenerMap } from '../state/types'

export interface EventBusOptions {
  diagnosticsEnabled: boolean
  traceLimit: number
}

export interface EventBus<R extends NodeTypeRegistry> {
  emit<K extends keyof BoardEventMap<R>>(
    event: K,
    ...args: Parameters<BoardEventMap<R>[K]>
  ): void
  on<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): () => void
  once<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): () => void
  off<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): void
  exportTrace(): TraceEntry[]
}

export function createEventBus<R extends NodeTypeRegistry>(
  opts: EventBusOptions,
): EventBus<R> {
  const listeners: ListenerMap<R> = new Map()
  const trace: TraceEntry[] = []

  function emit<K extends keyof BoardEventMap<R>>(
    event: K,
    ...args: Parameters<BoardEventMap<R>[K]>
  ): void {
    if (opts.diagnosticsEnabled) {
      trace.push({ event: String(event), timestamp: Date.now(), args })
      if (trace.length > opts.traceLimit) {
        trace.shift()
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      try {
        ;(handler as (...payload: Parameters<BoardEventMap<R>[K]>) => void)(
          ...args,
        )
      } catch (error) {
        console.error(`[board] handler for "${String(event)}" threw:`, error)
      }
    }
  }

  function on<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ) {
    const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
    set.add(handler as (...args: unknown[]) => void)
    listeners.set(event, set)
    return () => off(event, handler)
  }

  function once<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ) {
    const unsubscribe = on(event, ((...args: unknown[]) => {
      unsubscribe()
      ;(handler as (...payload: unknown[]) => void)(...args)
    }) as BoardEventMap<R>[K])
    return unsubscribe
  }

  function off<K extends keyof BoardEventMap<R>>(
    event: K,
    handler: BoardEventMap<R>[K],
  ): void {
    listeners.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  function exportTrace(): TraceEntry[] {
    return trace.slice()
  }

  return { emit, on, once, off, exportTrace }
}
