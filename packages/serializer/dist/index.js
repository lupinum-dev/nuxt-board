// src/index.ts
var typeHandlers = /* @__PURE__ */ new Map();
var jsonCanvasSerializer = {
  registerType(type, handler) {
    typeHandlers.set(type, handler);
  },
  export(snapshot, extras) {
    const nodes = snapshot.nodes.map((node) => serializeNode(node));
    return JSON.stringify(
      {
        nodes,
        edges: extras?.edges ?? []
      },
      null,
      2
    );
  },
  parse(json) {
    return JSON.parse(json);
  },
  toSnapshot(document) {
    const nodes = document.nodes.map((node) => deserializeNode(node));
    return {
      camera: { x: 0, y: 0, z: 1 },
      grid: { size: 10, majorEvery: 5, snap: true, pattern: "line" },
      nodes,
      selection: [],
      interaction: { mode: "idle" },
      nextZIndex: nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
    };
  }
};
function serializeNode(node) {
  const base = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  };
  if (node.type === "text") {
    base.text = typeof node.data.content === "string" ? node.data.content : "";
  }
  const handler = typeHandlers.get(node.type);
  const extra = handler?.serialize?.(node) ?? { "x-canvas:data": node.data };
  return {
    ...base,
    ...extra
  };
}
function deserializeNode(raw) {
  const handler = typeHandlers.get(raw.type);
  const data = handler?.deserialize?.(raw) ?? (raw.type === "text" ? { content: typeof raw.text === "string" ? raw.text : "" } : raw["x-canvas:data"] ?? {});
  return {
    id: raw.id,
    type: raw.type,
    x: raw.x,
    y: raw.y,
    width: raw.width,
    height: raw.height,
    data,
    zIndex: 1,
    locked: false,
    visible: true
  };
}
export {
  jsonCanvasSerializer
};
