---
'@lupinum/board-core': patch
'@lupinum/board-history': patch
'@lupinum/board-connections': patch
'@lupinum/nuxt-board': patch
---

Preserve history when undo or redo is rejected, and complete replay bookkeeping before listeners can create a new branch. Undo and redo with a retained frame now reject calls inside an active batch; call them after the batch completes. This prevents partial replay and lost history.

Create an empty-drop connection and its new target node in one atomic batch. Grouping in both playgrounds is one undoable action, including selection and child assignment.
