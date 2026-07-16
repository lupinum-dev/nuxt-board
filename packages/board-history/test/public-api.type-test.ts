import type { HistoryEntry } from '../src'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

declare const entry: HistoryEntry

entry.label
entry.timestamp

// @ts-expect-error Recorded replay actions are internal implementation details.
entry.actions

const engine = createBoardEngine({
  plugins: [historyPlugin(), connectionsPlugin()],
})
engine.plugins.history.undo()
engine.plugins.connections.getEdges()
engine.on('history:push', (historyEntry) => historyEntry.label)
engine.on('edge:deleted', (edgeId) => edgeId)
