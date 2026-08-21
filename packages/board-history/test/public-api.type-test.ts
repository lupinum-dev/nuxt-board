import type { HistoryEntry } from '../src'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'
import { BoardHistoryShortcuts } from '../src/vue'

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

type HistoryShortcutProps = InstanceType<typeof BoardHistoryShortcuts>['$props']

const shortcutProps: HistoryShortcutProps = {
  history: engine.plugins.history,
}
shortcutProps.history.undo()

// @ts-expect-error The shortcut component requires an explicit history owner.
const missingHistory: HistoryShortcutProps = {}

// @ts-expect-error The history prop must implement the complete HistoryApi.
const invalidHistory: HistoryShortcutProps = { history: { undo() {} } }
