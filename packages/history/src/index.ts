import type { BoardSnapshot, CanvasEngine, CanvasPlugin, CanvasPluginContext } from '@canvas/core'

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

declare module '@canvas/core' {
  interface CanvasEventMap {
    'history:push': (entry: HistoryEntry) => void
    'history:undo': (entry: HistoryEntry | null) => void
    'history:redo': (entry: HistoryEntry | null) => void
    'history:clear': () => void
  }

  interface CanvasEngine {
    undo?: () => void
    redo?: () => void
    canUndo?: () => boolean
    canRedo?: () => boolean
    clearHistory?: () => void
    getHistoryState?: () => HistoryState
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

type ExtendedEngine = CanvasEngine & {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
  getHistoryState: () => HistoryState
}

type EdgeEnabledEngine = CanvasEngine & {
  getEdges?: () => Array<Record<string, unknown>>
  createEdge?: (input: Record<string, unknown>) => Record<string, unknown>
  deleteEdge?: (id: string) => void
}

export function historyPlugin(options: HistoryPluginOptions = {}): CanvasPlugin {
  const maxSteps = Math.max(1, options.maxSteps ?? 200)
  const debounceMs = Math.max(0, options.debounceMs ?? 300)
  const excluded = new Set([...(options.exclude ?? []), ...DEFAULT_EXCLUDE])

  return {
    name: 'history',
    install(engine) {
      const target = engine as ExtendedEngine
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
        const connectionEngine = engine as EdgeEnabledEngine
        const extras: Record<string, unknown> = {}
        if (typeof connectionEngine.getEdges === 'function') {
          extras.connections = {
            edges: structuredClone(connectionEngine.getEdges())
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
        const connectionEngine = engine as EdgeEnabledEngine
        if (
          !extras?.connections ||
          typeof connectionEngine.getEdges !== 'function' ||
          typeof connectionEngine.deleteEdge !== 'function' ||
          typeof connectionEngine.createEdge !== 'function'
        ) {
          return
        }
        const currentEdges = connectionEngine.getEdges()
        for (const edge of currentEdges) {
          if (typeof edge.id === 'string') {
            connectionEngine.deleteEdge(edge.id)
          }
        }
        const nextEdges = ((extras.connections as { edges?: Array<Record<string, unknown>> }).edges ?? []).map((edge) =>
          structuredClone(edge)
        )
        for (const edge of nextEdges) {
          connectionEngine.createEdge(edge)
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

      target.undo = () => {
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
      }

      target.redo = () => {
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
      }

      target.canUndo = () => {
        flushPending()
        return undoStack.length > 0
      }

      target.canRedo = () => {
        flushPending()
        return redoStack.length > 0
      }

      target.clearHistory = () => {
        undoStack.splice(0, undoStack.length)
        redoStack.splice(0, redoStack.length)
        pendingCommand = null
        previousSnapshot = canonicalSnapshot(engine.getSnapshot())
        previousExtras = captureExtras()
        engine.emit('history:clear')
      }

      target.getHistoryState = () => ({
        undoDepth: undoStack.length,
        redoDepth: redoStack.length,
        current: pendingCommand?.name ?? undoStack[undoStack.length - 1]?.label ?? null
      })

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
