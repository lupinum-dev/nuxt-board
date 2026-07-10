import type {
  BoardEventMap,
  BoardPlugin,
  BoardPluginApis,
} from '@lupinum/board-core'
import {
  defineInternalBoardPlugin,
  type InternalHistoryRoot,
} from '@lupinum/board-core/internal'

/** Public history state exposed by the history plugin extension. */
export interface HistoryState {
  undoDepth: number
  redoDepth: number
  current: string | null
}

/** Public metadata for a single undoable history frame. */
export interface HistoryEntry {
  label: string
  timestamp: number
}

interface HistoryFrame extends HistoryEntry {
  before: InternalHistoryRoot
  after: InternalHistoryRoot
}

/** Options for bounding retained structural history roots. */
export interface HistoryPluginOptions {
  maxSteps?: number
}

export interface HistoryExtension {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
  getState: () => HistoryState
}

interface HistoryEventMap extends BoardEventMap {
  'history:push': (entry: HistoryEntry) => void
  'history:undo': (entry: HistoryEntry | null) => void
  'history:redo': (entry: HistoryEntry | null) => void
  'history:clear': () => void
}

interface HistoryFeatureExtensions extends BoardPluginApis {
  history: HistoryExtension
}

declare module '@lupinum/board-core' {
  interface BoardEventMap {
    'history:push': (entry: HistoryEntry) => void
    'history:undo': (entry: HistoryEntry | null) => void
    'history:redo': (entry: HistoryEntry | null) => void
    'history:clear': () => void
  }
}

function toHistoryEntry(frame: HistoryFrame): HistoryEntry {
  return { label: frame.label, timestamp: frame.timestamp }
}

/** Install deterministic undo/redo backed by committed structural roots. */
export function historyPlugin(
  options: HistoryPluginOptions = {},
): BoardPlugin<HistoryFeatureExtensions> {
  const maxSteps = Math.max(1, options.maxSteps ?? 200)

  return defineInternalBoardPlugin<HistoryFeatureExtensions, HistoryEventMap>({
    name: 'history',
    install(engine) {
      const undoStack: HistoryFrame[] = []
      const redoStack: HistoryFrame[] = []

      const offCommit = engine.onCommit((commit) => {
        if (commit.metadata.history === 'ignore') return
        const frame: HistoryFrame = {
          label: commit.label,
          timestamp: commit.timestamp,
          before: commit.before,
          after: commit.after,
        }
        undoStack.push(frame)
        if (undoStack.length > maxSteps) undoStack.shift()
        redoStack.length = 0
        engine.emit('history:push', toHistoryEntry(frame))
      })

      const api: HistoryExtension = {
        undo() {
          const frame = undoStack.pop() ?? null
          if (!frame) {
            engine.emit('history:undo', null)
            return
          }
          engine.restoreHistoryRoot(frame.before)
          redoStack.push(frame)
          engine.emit('history:undo', toHistoryEntry(frame))
        },
        redo() {
          const frame = redoStack.pop() ?? null
          if (!frame) {
            engine.emit('history:redo', null)
            return
          }
          engine.restoreHistoryRoot(frame.after)
          undoStack.push(frame)
          engine.emit('history:redo', toHistoryEntry(frame))
        },
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        clear() {
          undoStack.length = 0
          redoStack.length = 0
          engine.emit('history:clear')
        },
        getState: () => ({
          undoDepth: undoStack.length,
          redoDepth: redoStack.length,
          current: undoStack[undoStack.length - 1]?.label ?? null,
        }),
      }

      engine.extend('history', api)
      return offCommit
    },
  })
}
