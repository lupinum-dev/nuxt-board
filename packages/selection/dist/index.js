// src/index.ts
function selectionPlugin() {
  return {
    name: "selection",
    install() {
      return void 0;
    }
  };
}
function getSelectionNodes(engine) {
  const selected = new Set(engine.getSelection());
  return engine.getSnapshot().nodes.filter((node) => selected.has(node.id));
}
function getSelectionBounds(engine) {
  const nodes = getSelectionNodes(engine);
  if (nodes.length === 0) {
    return null;
  }
  return {
    minX: Math.min(...nodes.map((node) => node.x)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height))
  };
}
function toggleIds(current, ids) {
  const next = new Set(current);
  for (const id of ids) {
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
  }
  return Array.from(next);
}
export {
  getSelectionBounds,
  getSelectionNodes,
  selectionPlugin,
  toggleIds
};
