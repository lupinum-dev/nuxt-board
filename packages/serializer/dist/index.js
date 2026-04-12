// src/index.ts
function createJsonCanvasSerializer() {
  const typeHandlers = /* @__PURE__ */ new Map();
  function serializeNodeEntry(node) {
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
  function deserializeNodeEntry(raw) {
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
  return {
    registerType(type, handler) {
      typeHandlers.set(type, handler);
    },
    export(input, extras) {
      const snapshot = typeof input.getSnapshot === "function" ? input.getSnapshot() : input;
      const engineRef = typeof input.getSnapshot === "function" ? input : null;
      const nodes = snapshot.nodes.map((node) => serializeNodeEntry(node));
      const connectionEdges = extras?.edges ?? (engineRef?.getEdges?.() ?? []);
      return JSON.stringify(
        {
          nodes,
          edges: connectionEdges,
          "x-canvas": {
            camera: snapshot.camera,
            grid: snapshot.grid,
            nextZIndex: snapshot.nextZIndex,
            nodes: Object.fromEntries(
              snapshot.nodes.map((node) => [
                node.id,
                {
                  zIndex: node.zIndex,
                  locked: node.locked,
                  visible: node.visible
                }
              ])
            ),
            edges: connectionEdges
          }
        },
        null,
        2
      );
    },
    parse(json) {
      const parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error("Invalid JSON Canvas document: missing nodes array.");
      }
      return parsed;
    },
    toSnapshot(document) {
      const nodes = document.nodes.map((node) => deserializeNodeEntry(node));
      const extensions = document["x-canvas"];
      return {
        camera: extensions?.camera ?? { x: 0, y: 0, z: 1 },
        grid: extensions?.grid ?? { size: 10, majorEvery: 5, snap: true, pattern: "line" },
        nodes: nodes.map((node) => {
          const meta = extensions?.nodes?.[node.id];
          return {
            ...node,
            zIndex: meta?.zIndex ?? node.zIndex,
            locked: meta?.locked ?? node.locked,
            visible: meta?.visible ?? node.visible
          };
        }),
        selection: [],
        interaction: { mode: "idle" },
        snapGuides: [],
        nextZIndex: extensions?.nextZIndex ?? nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
      };
    }
  };
}
var jsonCanvasSerializer = createJsonCanvasSerializer();
export {
  createJsonCanvasSerializer,
  jsonCanvasSerializer
};
