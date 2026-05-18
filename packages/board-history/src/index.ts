import type {
  BoardExtension,
  BoardEventMap,
  BoardFeatureExtensions,
} from '@lupinum/board-core'
import type {
  InternalBoardAction,
  InternalBoardFeature,
  InternalFeatureContext,
} from '@lupinum/board-core/internal'

/** Public history state exposed by the history plugin extension. */
export interface HistoryState {
  undoDepth: number
  redoDepth: number
  current: string | null
}

/** A single undoable history frame captured from dispatched actions. */
export interface HistoryEntry {
  label: string
  actions: InternalBoardAction[]
  timestamp: number
}

/** Options for configuring stack depth and move coalescing. */
export interface HistoryPluginOptions {
  maxSteps?: number
  debounceMs?: number
}

declare module '@lupinum/board-core' {
  interface BoardEventMap {
    'history:push': (entry: HistoryEntry) => void
    'history:undo': (entry: HistoryEntry | null) => void
    'history:redo': (entry: HistoryEntry | null) => void
    'history:clear': () => void
  }

  interface BoardFeatureExtensions {
    history: {
      undo: () => void
      redo: () => void
      canUndo: () => boolean
      canRedo: () => boolean
      flushPending: () => void
      clear: () => void
      getState: () => HistoryState
    }
  }
}

function isCoalescableMoves(prev: HistoryEntry, next: HistoryEntry): boolean {
  if (prev.label !== next.label) return false
  if (prev.actions.length !== 1 || next.actions.length !== 1) return false
  const a = prev.actions[0]
  const b = next.actions[0]
  if (!a || !b) return false
  if (a.type !== 'NODES_MOVED' || b.type !== 'NODES_MOVED') return false
  if (a.deltas.length !== b.deltas.length) return false
  for (let i = 0; i < a.deltas.length; i++) {
    if (a.deltas[i]!.id !== b.deltas[i]!.id) return false
  }
  return true
}

function isCoalescableNodeUpdate(
  prev: HistoryEntry,
  next: HistoryEntry,
): boolean {
  if (prev.label !== next.label) return false
  if (prev.actions.length !== 1 || next.actions.length !== 1) return false
  const a = prev.actions[0]
  const b = next.actions[0]
  return Boolean(
    a &&
    b &&
    a.type === 'NODE_UPDATED' &&
    b.type === 'NODE_UPDATED' &&
    a.id === b.id,
  )
}

function mergeMoves(prev: HistoryEntry, next: HistoryEntry): HistoryEntry {
  const a = prev.actions[0] as InternalBoardAction & { type: 'NODES_MOVED' }
  const b = next.actions[0] as InternalBoardAction & { type: 'NODES_MOVED' }
  const merged = a.deltas.map((delta, i) => ({
    id: delta.id,
    before: delta.before,
    after: b.deltas[i]!.after,
  }))
  return {
    label: prev.label,
    actions: [{ type: 'NODES_MOVED', deltas: merged }],
    timestamp: next.timestamp,
  }
}

function mergeNodeUpdate(prev: HistoryEntry, next: HistoryEntry): HistoryEntry {
  const a = prev.actions[0] as InternalBoardAction & { type: 'NODE_UPDATED' }
  const b = next.actions[0] as InternalBoardAction & { type: 'NODE_UPDATED' }
  return {
    label: prev.label,
    actions: [
      {
        type: 'NODE_UPDATED',
        id: a.id,
        before: a.before,
        after: b.after,
      },
    ],
    timestamp: next.timestamp,
  }
}

function canCoalesce(prev: HistoryEntry, next: HistoryEntry): boolean {
  return isCoalescableMoves(prev, next) || isCoalescableNodeUpdate(prev, next)
}

function mergeCoalesced(prev: HistoryEntry, next: HistoryEntry): HistoryEntry {
  return isCoalescableMoves(prev, next)
    ? mergeMoves(prev, next)
    : mergeNodeUpdate(prev, next)
}

function undoReplayPriority(action: InternalBoardAction): number {
  switch (action.type) {
    case 'NODE_CREATED':
      return 0
    case 'NODE_UPDATED':
    case 'NODES_MOVED':
    case 'GRID_UPDATED':
    case 'NEXT_Z_INDEX_BUMPED':
      return 1
    case 'FEATURE_ACTION':
      return 2
    case 'SELECTION_SET':
      return 3
    case 'NODE_DELETED':
      return 4
    case 'BATCH':
      return 5
  }
}

function getUndoReplayActions(
  engine: InternalFeatureContext,
  entry: HistoryEntry,
): InternalBoardAction[] {
  return [...entry.actions]
    .reverse()
    .map((action) => engine.invertAction(action))
    .sort((left, right) => undoReplayPriority(left) - undoReplayPriority(right))
}

/**
 * Install undo/redo support backed by inverse action replay.
 *
 * The plugin listens to engine actions, groups them per command, coalesces drag
 * moves, and exposes a `history` extension on the engine.
 */
export function historyPlugin(
  options: HistoryPluginOptions = {},
): BoardExtension {
  const maxSteps = Math.max(1, options.maxSteps ?? 200)
  const debounceMs = Math.max(0, options.debounceMs ?? 300)

  const feature: InternalBoardFeature = {
    name: 'history',
    install(engine) {
      const emit = engine.emit as <K extends keyof BoardEventMap>(
        event: K,
        ...args: Parameters<BoardEventMap[K]>
      ) => void
      const extend = engine.extend as (
        key: 'history',
        value: BoardFeatureExtensions['history'],
      ) => void
      const undoStack: HistoryEntry[] = []
      const redoStack: HistoryEntry[] = []

      let activeCommand: string | null = null
      let activeActions: InternalBoardAction[] = []
      let pending: HistoryEntry | null = null
      let pendingTimer: ReturnType<typeof setTimeout> | null = null
      let replaying = false

      function clearPendingTimer(): void {
        if (pendingTimer !== null) {
          clearTimeout(pendingTimer)
          pendingTimer = null
        }
      }

      function commitPending(): void {
        clearPendingTimer()
        if (!pending) return
        const entry = pending
        pending = null
        const last = undoStack[undoStack.length - 1]
        if (last && canCoalesce(last, entry)) {
          undoStack[undoStack.length - 1] = mergeCoalesced(last, entry)
        } else {
          undoStack.push(entry)
          if (undoStack.length > maxSteps) {
            undoStack.shift()
          }
        }
        redoStack.length = 0
        const final = undoStack[undoStack.length - 1]!
        emit('history:push', final)
      }

      function schedulePending(entry: HistoryEntry): void {
        if (pending) {
          if (canCoalesce(pending, entry)) {
            pending = mergeCoalesced(pending, entry)
          } else {
            commitPending()
            pending = entry
          }
        } else {
          pending = entry
        }
        clearPendingTimer()
        if (debounceMs > 0) {
          pendingTimer = setTimeout(commitPending, debounceMs)
        } else {
          commitPending()
        }
      }

      const offAction = engine.onAction((action) => {
        if (replaying) return
        if (activeCommand === null) return
        activeActions.push(action)
      })

      const offBefore = engine.on('command:before', (name, _args, metadata) => {
        if (replaying) return
        if (metadata.history === 'ignore') {
          activeCommand = null
          activeActions = []
          return
        }
        activeCommand = name
        activeActions = []
      })

      const offAfter = engine.on(
        'command:after',
        (name, _args, _duration, metadata) => {
          if (replaying) return
          if (metadata.history === 'ignore') return
          if (activeCommand !== name) {
            activeCommand = null
            activeActions = []
            return
          }
          const captured = activeActions
          activeCommand = null
          activeActions = []
          if (captured.length === 0) return
          schedulePending({
            label: name,
            actions: captured,
            timestamp: Date.now(),
          })
        },
      )

      function applyEntry(
        entry: HistoryEntry,
        direction: 'undo' | 'redo',
      ): void {
        replaying = true
        try {
          const actions =
            direction === 'undo'
              ? getUndoReplayActions(engine, entry)
              : entry.actions
          engine.batch(() => {
            for (const action of actions) {
              engine.applyRecordedAction(action)
            }
          })
        } finally {
          replaying = false
        }
      }

      const api = {
        undo: () => {
          commitPending()
          const entry = undoStack.pop() ?? null
          if (!entry) {
            emit('history:undo', null)
            return
          }
          applyEntry(entry, 'undo')
          redoStack.push(entry)
          emit('history:undo', entry)
        },

        redo: () => {
          commitPending()
          const entry = redoStack.pop() ?? null
          if (!entry) {
            emit('history:redo', null)
            return
          }
          applyEntry(entry, 'redo')
          undoStack.push(entry)
          emit('history:redo', entry)
        },

        canUndo: () => {
          return undoStack.length > 0
        },

        canRedo: () => {
          return redoStack.length > 0
        },

        flushPending: () => {
          commitPending()
        },

        clear: () => {
          undoStack.length = 0
          redoStack.length = 0
          pending = null
          clearPendingTimer()
          activeCommand = null
          activeActions = []
          emit('history:clear')
        },

        getState: (): HistoryState => ({
          undoDepth: undoStack.length,
          redoDepth: redoStack.length,
          current:
            pending?.label ?? undoStack[undoStack.length - 1]?.label ?? null,
        }),
      }

      extend('history', api)

      return () => {
        offAction()
        offBefore()
        offAfter()
        clearPendingTimer()
      }
    },
  }

  return feature
}
