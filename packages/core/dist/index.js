// src/math.ts
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function screenToWorld(screenPoint, camera) {
  return {
    x: screenPoint.x / camera.z - camera.x,
    y: screenPoint.y / camera.z - camera.y
  };
}
function worldToScreen(worldPoint, camera) {
  return {
    x: (worldPoint.x + camera.x) * camera.z,
    y: (worldPoint.y + camera.y) * camera.z
  };
}
function getVisibleBounds(viewportWidth, viewportHeight, camera) {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld({ x: viewportWidth, y: viewportHeight }, camera);
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y
  };
}
function zoomCameraAtScreenPoint(screenPoint, delta, camera, minZoom, maxZoom) {
  const nextZoom = clamp(camera.z * Math.pow(2, -delta * 0.01), minZoom, maxZoom);
  const before = screenToWorld(screenPoint, camera);
  const after = {
    x: screenPoint.x / nextZoom - camera.x,
    y: screenPoint.y / nextZoom - camera.y
  };
  return {
    x: camera.x + (after.x - before.x),
    y: camera.y + (after.y - before.y),
    z: nextZoom
  };
}

// src/resize.ts
function applyResizeDelta(node, handle, deltaX, deltaY, constraints) {
  let { x, y, width, height } = node;
  if (handle.includes("e")) {
    width = Math.max(constraints.minWidth, node.width + deltaX);
  }
  if (handle.includes("s")) {
    height = Math.max(constraints.minHeight, node.height + deltaY);
  }
  if (handle.includes("w")) {
    const nextWidth = Math.max(constraints.minWidth, node.width - deltaX);
    const consumed = node.width - nextWidth;
    width = nextWidth;
    x = node.x + consumed;
  }
  if (handle.includes("n")) {
    const nextHeight = Math.max(constraints.minHeight, node.height - deltaY);
    const consumed = node.height - nextHeight;
    height = nextHeight;
    y = node.y + consumed;
  }
  return { x, y, width, height };
}

// src/invariants.ts
function createInvariantSnapshot(state) {
  return {
    camera: { ...state.camera },
    nodes: Array.from(state.nodes.values()).map((node) => ({ ...node })).sort((a, b) => a.zIndex - b.zIndex),
    selection: Array.from(state.selection.values()),
    interaction: cloneInteraction(state.interaction),
    nextZIndex: state.nextZIndex
  };
}
function cloneInteraction(state) {
  switch (state.mode) {
    case "idle":
      return { mode: "idle" };
    case "editing-text":
      return { mode: "editing-text", nodeId: state.nodeId };
    case "panning":
      return { mode: "panning", pointerId: state.pointerId, lastScreenPoint: { ...state.lastScreenPoint } };
    case "dragging-node":
      return {
        mode: "dragging-node",
        pointerId: state.pointerId,
        nodeId: state.nodeId,
        lastScreenPoint: { ...state.lastScreenPoint }
      };
    case "resizing-node":
      return {
        mode: "resizing-node",
        pointerId: state.pointerId,
        nodeId: state.nodeId,
        handle: state.handle,
        startScreenPoint: { ...state.startScreenPoint },
        startNodeBounds: { ...state.startNodeBounds }
      };
  }
}
function validateState(state, context) {
  const failures = [];
  const snapshot = createInvariantSnapshot(state);
  const push = (name, message) => {
    failures.push({ name, message, context, snapshot });
  };
  if (!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y) || !Number.isFinite(state.camera.z)) {
    push("camera.finite", "Camera values must always be finite numbers.");
  }
  const zIndexes = /* @__PURE__ */ new Set();
  for (const node of state.nodes.values()) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
      push("node.finite", `Node ${node.id} contains non-finite geometry.`);
    }
    if (node.width < 1 || node.height < 1) {
      push("node.size", `Node ${node.id} must have positive width and height.`);
    }
    if (zIndexes.has(node.zIndex)) {
      push("node.zindex.unique", `Node ${node.id} shares a z-index with another node.`);
    }
    zIndexes.add(node.zIndex);
  }
  for (const id of state.selection.values()) {
    if (!state.nodes.has(id)) {
      push("selection.exists", `Selected node ${id} does not exist.`);
    }
  }
  if (state.nextZIndex <= state.nodes.size) {
    const maxZ = Math.max(0, ...Array.from(state.nodes.values(), (node) => node.zIndex));
    if (state.nextZIndex <= maxZ) {
      push("node.zindex.monotonic", "nextZIndex must stay above every current node z-index.");
    }
  }
  if (state.interaction.mode === "dragging-node" || state.interaction.mode === "resizing-node" || state.interaction.mode === "editing-text") {
    if (!state.nodes.has(state.interaction.nodeId)) {
      push("interaction.node", `Active interaction references missing node ${state.interaction.nodeId}.`);
    }
  }
  return failures;
}

// src/engine.ts
var DEFAULTS = {
  minZoom: 0.1,
  maxZoom: 5,
  minNodeWidth: 50,
  minNodeHeight: 50,
  defaultNodeWidth: 240,
  defaultNodeHeight: 160,
  traceLimit: 300,
  diagnostics: true,
  strictInvariants: true
};
function createCanvasEngine(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const listeners = /* @__PURE__ */ new Set();
  const trace = [];
  const state = {
    camera: {
      x: options.initialCamera?.x ?? 0,
      y: options.initialCamera?.y ?? 0,
      z: options.initialCamera?.z ?? 1
    },
    nodes: /* @__PURE__ */ new Map(),
    selection: /* @__PURE__ */ new Set(),
    interaction: { mode: "idle" },
    nextZIndex: 1
  };
  for (const node of options.initialNodes ?? []) {
    state.nodes.set(node.id, { ...node });
    state.nextZIndex = Math.max(state.nextZIndex, node.zIndex + 1);
  }
  function emit(event) {
    if (config.diagnostics) {
      trace.push(event);
      if (trace.length > config.traceLimit) {
        trace.shift();
      }
    }
    for (const listener of listeners) {
      listener(event);
    }
  }
  function commit(command, fn, payload) {
    const started = performance.now();
    emit({ type: "command:start", command, timestamp: Date.now(), payload });
    fn();
    runInvariants(command);
    const snapshot = createInvariantSnapshot(state);
    emit({
      type: "state:changed",
      command,
      timestamp: Date.now(),
      snapshot
    });
    emit({ type: "command:end", command, timestamp: Date.now(), payload });
    const sample = {
      command,
      durationMs: performance.now() - started,
      timestamp: Date.now()
    };
    emit({ type: "performance:sample", timestamp: sample.timestamp, sample });
  }
  function runInvariants(context) {
    const failures = validateState(state, context);
    for (const failure of failures) {
      emit({
        type: "invariant:failed",
        timestamp: Date.now(),
        failure
      });
      options.onInvariantFailure?.(failure);
    }
    if (failures.length > 0 && config.strictInvariants) {
      throw new Error(`Canvas invariant failed in ${context}: ${failures[0]?.message}`);
    }
  }
  function assertNode(nodeId) {
    const node = state.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist.`);
    }
    return node;
  }
  function setInteraction(next) {
    state.interaction = next;
    emit({
      type: "interaction:changed",
      timestamp: Date.now(),
      interaction: createInvariantSnapshot(state).interaction
    });
  }
  function normalizeNode(input) {
    return {
      id: input.id ?? crypto.randomUUID(),
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? config.defaultNodeWidth,
      height: input.height ?? config.defaultNodeHeight,
      text: input.text ?? "",
      zIndex: state.nextZIndex++
    };
  }
  const engine = {
    getState() {
      return state;
    },
    getSnapshot() {
      return createInvariantSnapshot(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    exportTrace() {
      return trace.slice();
    },
    screenToWorld(screenPoint) {
      return screenToWorld(screenPoint, state.camera);
    },
    worldToScreen(worldPoint) {
      return worldToScreen(worldPoint, state.camera);
    },
    getVisibleBounds(viewportWidth, viewportHeight) {
      return getVisibleBounds(viewportWidth, viewportHeight, state.camera);
    },
    panByScreenDelta(deltaX, deltaY) {
      commit("panByScreenDelta", () => {
        state.camera.x -= deltaX / state.camera.z;
        state.camera.y -= deltaY / state.camera.z;
      }, { deltaX, deltaY });
    },
    zoomAtScreenPoint(screenPoint, delta) {
      commit("zoomAtScreenPoint", () => {
        state.camera = zoomCameraAtScreenPoint(
          screenPoint,
          delta,
          state.camera,
          config.minZoom,
          config.maxZoom
        );
      }, { screenPoint, delta });
    },
    createNode(input) {
      const node = normalizeNode(input);
      commit("createNode", () => {
        state.nodes.set(node.id, node);
        state.selection = /* @__PURE__ */ new Set([node.id]);
      }, { nodeId: node.id });
      return { ...node };
    },
    updateNode(nodeId, patch) {
      const node = assertNode(nodeId);
      commit("updateNode", () => {
        Object.assign(node, patch);
      }, { nodeId });
      return { ...node };
    },
    moveNode(nodeId, deltaWorldX, deltaWorldY) {
      const node = assertNode(nodeId);
      commit("moveNode", () => {
        node.x += deltaWorldX;
        node.y += deltaWorldY;
      }, { nodeId, deltaWorldX, deltaWorldY });
      return { ...node };
    },
    resizeNode(nodeId, handle, deltaWorldX, deltaWorldY) {
      const node = assertNode(nodeId);
      commit("resizeNode", () => {
        const next = applyResizeDelta(node, handle, deltaWorldX, deltaWorldY, {
          minWidth: config.minNodeWidth,
          minHeight: config.minNodeHeight
        });
        Object.assign(node, next);
      }, { nodeId, handle, deltaWorldX, deltaWorldY });
      return { ...node };
    },
    select(nodeIds, mode = "replace") {
      const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
      commit("select", () => {
        if (mode === "replace") {
          state.selection = new Set(ids);
          return;
        }
        const next = new Set(state.selection);
        for (const id of ids) {
          if (mode === "toggle") {
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
          } else {
            next.add(id);
          }
        }
        state.selection = next;
      }, { ids, mode });
    },
    clearSelection() {
      commit("clearSelection", () => {
        state.selection = /* @__PURE__ */ new Set();
      });
    },
    deleteSelected() {
      commit("deleteSelected", () => {
        for (const id of state.selection.values()) {
          state.nodes.delete(id);
        }
        state.selection = /* @__PURE__ */ new Set();
        if (state.interaction.mode !== "idle") {
          setInteraction({ mode: "idle" });
        }
      });
    },
    bringToFront(nodeId) {
      const node = assertNode(nodeId);
      commit("bringToFront", () => {
        node.zIndex = state.nextZIndex++;
      }, { nodeId });
      return { ...node };
    },
    beginTextEdit(nodeId) {
      assertNode(nodeId);
      commit("beginTextEdit", () => {
        state.selection = /* @__PURE__ */ new Set([nodeId]);
        setInteraction({ mode: "editing-text", nodeId });
      }, { nodeId });
    },
    commitTextEdit(nodeId, text) {
      const node = assertNode(nodeId);
      commit("commitTextEdit", () => {
        node.text = text;
        setInteraction({ mode: "idle" });
      }, { nodeId });
      return { ...node };
    },
    beginPan(pointerId, screenPoint) {
      commit("beginPan", () => {
        setInteraction({ mode: "panning", pointerId, lastScreenPoint: { ...screenPoint } });
      }, { pointerId, screenPoint });
    },
    beginNodeDrag(nodeId, pointerId, screenPoint) {
      assertNode(nodeId);
      commit("beginNodeDrag", () => {
        state.selection = /* @__PURE__ */ new Set([nodeId]);
        engine.bringToFront(nodeId);
        setInteraction({
          mode: "dragging-node",
          pointerId,
          nodeId,
          lastScreenPoint: { ...screenPoint }
        });
      }, { nodeId, pointerId, screenPoint });
    },
    beginResize(nodeId, handle, pointerId, screenPoint) {
      const node = assertNode(nodeId);
      commit("beginResize", () => {
        state.selection = /* @__PURE__ */ new Set([nodeId]);
        engine.bringToFront(nodeId);
        setInteraction({
          mode: "resizing-node",
          pointerId,
          nodeId,
          handle,
          startScreenPoint: { ...screenPoint },
          startNodeBounds: {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
          }
        });
      }, { nodeId, handle, pointerId, screenPoint });
    },
    updatePointer(pointerId, screenPoint) {
      const interaction = state.interaction;
      if (interaction.mode === "idle" || interaction.mode === "editing-text") {
        return;
      }
      if (interaction.pointerId !== pointerId) {
        return;
      }
      if (interaction.mode === "panning") {
        commit("updatePointer:pan", () => {
          const deltaX = screenPoint.x - interaction.lastScreenPoint.x;
          const deltaY = screenPoint.y - interaction.lastScreenPoint.y;
          state.camera.x -= deltaX / state.camera.z;
          state.camera.y -= deltaY / state.camera.z;
          interaction.lastScreenPoint = { ...screenPoint };
        }, { pointerId, screenPoint });
        return;
      }
      if (interaction.mode === "dragging-node") {
        const node2 = assertNode(interaction.nodeId);
        commit("updatePointer:dragging-node", () => {
          const deltaX = (screenPoint.x - interaction.lastScreenPoint.x) / state.camera.z;
          const deltaY = (screenPoint.y - interaction.lastScreenPoint.y) / state.camera.z;
          node2.x += deltaX;
          node2.y += deltaY;
          interaction.lastScreenPoint = { ...screenPoint };
        }, { pointerId, screenPoint, nodeId: interaction.nodeId });
        return;
      }
      const node = assertNode(interaction.nodeId);
      commit("updatePointer:resizing-node", () => {
        const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z;
        const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z;
        const next = applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, {
          minWidth: config.minNodeWidth,
          minHeight: config.minNodeHeight
        });
        Object.assign(node, next);
      }, { pointerId, screenPoint, nodeId: interaction.nodeId, handle: interaction.handle });
    },
    endInteraction(pointerId) {
      const interaction = state.interaction;
      if (interaction.mode === "idle") {
        return;
      }
      if ("pointerId" in interaction && pointerId !== void 0 && pointerId !== interaction.pointerId) {
        return;
      }
      commit("endInteraction", () => {
        setInteraction({ mode: "idle" });
      }, { pointerId });
    }
  };
  runInvariants("createCanvasEngine");
  return engine;
}
export {
  applyResizeDelta,
  clamp,
  createCanvasEngine,
  getVisibleBounds,
  screenToWorld,
  worldToScreen,
  zoomCameraAtScreenPoint
};
