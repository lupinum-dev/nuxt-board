import type {
  BoardEventMap,
  BoardPlugin,
  BoardPluginApis,
} from '@lupinum/board-core'
import {
  defineInternalBoardPlugin,
  type InternalHistoryRoot,
} from '@lupinum/board-core/internal'

/** Public history state exposed by the history plugin API. */
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

export interface HistoryApi {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
  getState: () => HistoryState
}

export interface HistoryEventMap extends BoardEventMap {
  'history:push': (entry: HistoryEntry) => void
  'history:undo': (entry: HistoryEntry | null) => void
  'history:redo': (entry: HistoryEntry | null) => void
  'history:clear': () => void
}

interface HistoryPluginApis extends BoardPluginApis {
  history: HistoryApi
}

function toHistoryEntry(frame: HistoryFrame): HistoryEntry {
  return { label: frame.label, timestamp: frame.timestamp }
}

/** Install deterministic undo/redo backed by committed structural roots. */
export function historyPlugin(
  options: HistoryPluginOptions = {},
): BoardPlugin<HistoryPluginApis, HistoryEventMap> {
  const maxSteps = Math.max(1, options.maxSteps ?? 200)

  return defineInternalBoardPlugin<HistoryPluginApis, HistoryEventMap>({
    name: 'history',
    install(engine) {
      const undoStack: HistoryFrame[] = []
      const redoStack: HistoryFrame[] = []

      const offCommit = engine.projectCommit((commit) => {
        if (commit.metadata.history === 'ignore') return () => undefined
        const frame: HistoryFrame = Object.freeze({
          label: commit.label,
          timestamp: commit.timestamp,
          before: commit.before,
          after: commit.after,
        })
        return () => {
          undoStack.push(frame)
          if (undoStack.length > maxSteps) undoStack.shift()
          redoStack.length = 0
          engine.emit('history:push', toHistoryEntry(frame))
        }
      })

      const api: HistoryApi = {
        undo() {
          engine.assertActive()
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
          engine.assertActive()
          const frame = redoStack.pop() ?? null
          if (!frame) {
            engine.emit('history:redo', null)
            return
          }
          engine.restoreHistoryRoot(frame.after)
          undoStack.push(frame)
          engine.emit('history:redo', toHistoryEntry(frame))
        },
        canUndo: () => {
          engine.assertActive()
          return undoStack.length > 0
        },
        canRedo: () => {
          engine.assertActive()
          return redoStack.length > 0
        },
        clear() {
          engine.assertActive()
          undoStack.length = 0
          redoStack.length = 0
          engine.emit('history:clear')
        },
        getState: () => {
          engine.assertActive()
          return {
            undoDepth: undoStack.length,
            redoDepth: redoStack.length,
            current: undoStack[undoStack.length - 1]?.label ?? null,
          }
        },
      }

      engine.extend('history', api)
      return offCommit
    },
  })
}
