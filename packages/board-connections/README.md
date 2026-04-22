# @lupinum/board-connections

Edges between nodes — bezier / orthogonal / arc routing, anchor sides, arrowheads, labels. Owns its own state slice in the engine, so undo/redo and serialization include edges automatically. Cascade-deletes edges when a connected node is removed.
