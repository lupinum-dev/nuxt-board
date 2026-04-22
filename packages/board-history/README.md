# @lupinum/board-history

Undo/redo plugin for `@lupinum/board-core`. Captures dispatched actions between `command:before` and `command:after`, coalesces consecutive moves of the same node into a single undoable step, and replays inverses to undo. No state snapshots — just an append-only action log.
