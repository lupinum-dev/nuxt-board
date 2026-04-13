import type { BoardSnapshot, BoardEngine, BoardPlugin } from '@lupinum/board-core'

export interface HistoryState {
  undoDepth: number
  redoDepth: number
  current: string | null
}

export interface HistoryEntry {
  label: string
  snapshot: BoardSnapshot
  extras?: Record<string, unknown>
  timestamp: number
}

export interface HistoryPluginOptions {
  maxSteps?: number
  debounceMs?: number
  exclude?: string[]
}

declare module '@lupinum/board-core' {
  interface BoardEventMap {
    'history:push': (entry: HistoryEntry) => void
    'history:undo': (entry: HistoryEntry | null) => void
    'history:redo': (entry: HistoryEntry | null) => void
    'history:clear': () => void
  }

  interface BoardEngineExtensions<R extends import('@lupinum/board-core').NodeTypeRegistry = import('@lupinum/board-core').NodeTypeRegistry> {
    history: {
      undo: () => void
      redo: () => void
      canUndo: () => boolean
      canRedo: () => boolean
      clear: () => void
      getState: () => HistoryState
    }
  }
}

const DEFAULT_EXCLUDE = new Set([
  'panBy',
  'panTo',
  'zoomAt',
  'zoomTo',
  'zoomToFit',
  'zoomToNodes',
  'beginPan',
  'beginNodeDrag',
  'beginResize',
  'beginBoxSelect',
  'beginTextEdit',
  'endInteraction'
])

export function historyPlugin(options: HistoryPluginOptions = {}): BoardPlugin {
  const maxSteps = Math.max(1, options.maxSteps ?? 200)
  const debounceMs = Math.max(0, options.debounceMs ?? 300)
  const excluded = new Set([...(options.exclude ?? []), ...DEFAULT_EXCLUDE])

  return {
    name: 'history',
    install(engine) {
      const getConnections = (): {
        getEdges: () => Array<Record<string, unknown>>
        deleteEdge: (id: string) => void
        createEdge: (input: Record<string, unknown>) => Record<string, unknown>
      } | null => {
        const value = (engine.ext as unknown as { connections?: unknown }).connections
        if (
          !value ||
          typeof (value as { getEdges?: unknown }).getEdges !== 'function' ||
          typeof (value as { deleteEdge?: unknown }).deleteEdge !== 'function' ||
          typeof (value as { createEdge?: unknown }).createEdge !== 'function'
        ) {
          return null
        }
        return value as {
          getEdges: () => Array<Record<string, unknown>>
          deleteEdge: (id: string) => void
          createEdge: (input: Record<string, unknown>) => Record<string, unknown>
        }
      }

      const undoStack: HistoryEntry[] = []
      const redoStack: HistoryEntry[] = []
      let previousSnapshot = canonicalSnapshot(engine.getSnapshot())
      let previousExtras: Record<string, unknown> | undefined
      let pendingCommand: { name: string; timer: ReturnType<typeof setTimeout> | null } | null = null
      let replaying = false

      function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
        // Nodes are immutable (new object on every mutation), so we only need
        // to copy the array — not deep-clone each node's data.
        return {
          ...snapshot,
          camera: { ...snapshot.camera },
          grid: { ...snapshot.grid },
          nodes: [...snapshot.nodes],
          selection: [...snapshot.selection],
          snapGuides: [...snapshot.snapGuides]
        }
      }

      function captureExtras(): Record<string, unknown> | undefined {
        const extras: Record<string, unknown> = {}
        const connections = getConnections()
        if (connections) {
          extras.connections = {
            edges: structuredClone(connections.getEdges())
          }
        }
        return Object.keys(extras).length > 0 ? extras : undefined
      }

      previousExtras = captureExtras()

      function commitEntry(commandName: string): void {
        const label = commandName
        undoStack.push({
          label,
          snapshot: cloneSnapshot(previousSnapshot),
          extras: previousExtras ? structuredClone(previousExtras) : undefined,
          timestamp: Date.now()
        })
        if (undoStack.length > maxSteps) {
          undoStack.shift()
        }
        redoStack.splice(0, redoStack.length)
        previousSnapshot = canonicalSnapshot(engine.getSnapshot())
        previousExtras = captureExtras()
        const entry = undoStack[undoStack.length - 1]
        if (entry) {
          engine.emit('history:push', entry)
        }
      }

      function flushPending(): void {
        if (!pendingCommand) {
          return
        }
        if (pendingCommand.timer) {
          clearTimeout(pendingCommand.timer)
        }
        const commandName = pendingCommand.name
        pendingCommand = null
        commitEntry(commandName)
      }

      function queuePush(commandName: string): void {
        if (pendingCommand?.name === commandName && debounceMs > 0) {
          if (pendingCommand.timer) {
            clearTimeout(pendingCommand.timer)
          }
          pendingCommand.timer = setTimeout(flushPending, debounceMs)
          return
        }

        flushPending()
        pendingCommand = {
          name: commandName,
          timer: debounceMs > 0 ? setTimeout(flushPending, debounceMs) : null
        }
        if (debounceMs === 0) {
          flushPending()
        }
      }

      function restoreExtras(extras?: Record<string, unknown>): void {
        const connections = getConnections()
        if (!extras?.connections || !connections) {
          return
        }
        const currentEdges = connections.getEdges()
        for (const edge of currentEdges) {
          connections.deleteEdge(String(edge.id))
        }
        const nextEdges = ((extras.connections as { edges?: Array<Record<string, unknown>> }).edges ?? []).map((edge) =>
          structuredClone(edge)
        )
        for (const edge of nextEdges) {
          connections.createEdge(edge)
        }
      }

      function replaceSnapshot(snapshot: BoardSnapshot, extras?: Record<string, unknown>): void {
        replaying = true
        try {
          engine.importJSON(JSON.stringify(snapshot), 'replace')
          restoreExtras(extras)
          previousSnapshot = canonicalSnapshot(engine.getSnapshot())
        } finally {
          replaying = false
        }
      }

      const api = {
        undo: () => {
        flushPending()
        const entry = undoStack.pop() ?? null
        if (!entry) {
          return
        }
        redoStack.push({
          label: entry.label,
          snapshot: cloneSnapshot(engine.getSnapshot()),
          extras: captureExtras(),
          timestamp: Date.now()
        })
        replaceSnapshot(entry.snapshot, entry.extras)
        engine.emit('history:undo', entry)
        },

        redo: () => {
        flushPending()
        const entry = redoStack.pop() ?? null
        if (!entry) {
          return
        }
        undoStack.push({
          label: entry.label,
          snapshot: cloneSnapshot(engine.getSnapshot()),
          extras: captureExtras(),
          timestamp: Date.now()
        })
        replaceSnapshot(entry.snapshot, entry.extras)
        engine.emit('history:redo', entry)
        },

        canUndo: () => {
        flushPending()
        return undoStack.length > 0
        },

        canRedo: () => {
        flushPending()
        return redoStack.length > 0
        },

        clear: () => {
        undoStack.splice(0, undoStack.length)
        redoStack.splice(0, redoStack.length)
        pendingCommand = null
        previousSnapshot = canonicalSnapshot(engine.getSnapshot())
        previousExtras = captureExtras()
        engine.emit('history:clear')
        },

        getState: () => ({
          undoDepth: undoStack.length,
          redoDepth: redoStack.length,
          current: pendingCommand?.name ?? undoStack[undoStack.length - 1]?.label ?? null
        })
      }

      engine.extend('history', api)

      const unsubscribeBefore = engine.on('command:before', () => {
        if (!replaying) {
          previousExtras = captureExtras()
        }
      })

      const unsubscribe = engine.on('command:after', (name) => {
        if (replaying || excluded.has(name)) {
          flushPending()
          const current = engine.getSnapshot()
          previousSnapshot = {
            ...previousSnapshot,
            camera: { ...current.camera },
            interaction: { mode: 'idle' }
          }
          return
        }
        queuePush(name)
      })

      return () => {
        unsubscribeBefore()
        unsubscribe()
        flushPending()
      }
    }
  }
}

function canonicalSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    ...snapshot,
    interaction: { mode: 'idle' }
  }
}
