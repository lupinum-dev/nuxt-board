// src/math.ts
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpCamera(from, to, t) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t)
  };
}
function screenToWorld(point, camera) {
  return {
    x: point.x / camera.z - camera.x,
    y: point.y / camera.z - camera.y
  };
}
function worldToScreen(point, camera) {
  return {
    x: (point.x + camera.x) * camera.z,
    y: (point.y + camera.y) * camera.z
  };
}
function getVisibleBounds(width, height, camera) {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld({ x: width, y: height }, camera);
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y
  };
}
function pointInBounds(point, bounds) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
function boundsIntersect(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}
function boundsContain(outer, inner) {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}
function getBoundsFromPoints(a, b) {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y)
  };
}
function snapValue(value, step) {
  if (step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}
function snapPoint(point, step) {
  return {
    x: snapValue(point.x, step),
    y: snapValue(point.y, step)
  };
}
function snapBounds(bounds, step) {
  return {
    minX: snapValue(bounds.minX, step),
    minY: snapValue(bounds.minY, step),
    maxX: snapValue(bounds.maxX, step),
    maxY: snapValue(bounds.maxY, step)
  };
}
function snapSize(value, step, min) {
  return Math.max(min, snapValue(value, step));
}
function zoomCameraAtScreenPoint(screenPoint, delta, camera, min, max) {
  const nextZoom = clamp(camera.z * Math.pow(2, -delta * 0.01), min, max);
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

// src/invariants.ts
function cloneInteraction(interaction) {
  switch (interaction.mode) {
    case "idle":
      return { mode: "idle" };
    case "editing-text":
      return { mode: "editing-text", nodeId: interaction.nodeId };
    case "panning":
      return {
        mode: "panning",
        pointerId: interaction.pointerId,
        lastScreenPoint: { ...interaction.lastScreenPoint }
      };
    case "dragging-nodes":
      return {
        mode: "dragging-nodes",
        pointerId: interaction.pointerId,
        nodeIds: [...interaction.nodeIds],
        startScreenPoint: { ...interaction.startScreenPoint },
        startNodePositions: Object.fromEntries(
          Object.entries(interaction.startNodePositions).map(([key, value]) => [key, { ...value }])
        )
      };
    case "resizing-node":
      return {
        mode: "resizing-node",
        pointerId: interaction.pointerId,
        nodeId: interaction.nodeId,
        handle: interaction.handle,
        startScreenPoint: { ...interaction.startScreenPoint },
        startNodeBounds: { ...interaction.startNodeBounds }
      };
    case "box-select":
      return {
        mode: "box-select",
        pointerId: interaction.pointerId,
        startScreenPoint: { ...interaction.startScreenPoint },
        currentScreenPoint: { ...interaction.currentScreenPoint },
        startWorldPoint: { ...interaction.startWorldPoint },
        currentWorldPoint: { ...interaction.currentWorldPoint }
      };
  }
}
function createSnapshot(state, grid) {
  return {
    camera: { ...state.camera },
    grid: { ...grid },
    nodes: Array.from(state.nodes.values()).map((node) => ({ ...node, data: cloneData(node.data) })).sort((a, b) => a.zIndex - b.zIndex),
    selection: Array.from(state.selection.values()),
    interaction: cloneInteraction(state.interaction),
    nextZIndex: state.nextZIndex
  };
}
function cloneData(data) {
  return structuredClone(data);
}
function validateState(state, grid, context) {
  const failures = [];
  const snapshot = createSnapshot(state, grid);
  const push = (name, message) => {
    failures.push({ name, message, context, snapshot });
  };
  if (!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y) || !Number.isFinite(state.camera.z)) {
    push("camera.finite", "Camera values must be finite numbers.");
  }
  if (grid.size <= 0 || !Number.isFinite(grid.size)) {
    push("grid.size", "Grid size must be a finite number greater than 0.");
  }
  if (grid.majorEvery < 1 || !Number.isFinite(grid.majorEvery)) {
    push("grid.majorEvery", "Grid majorEvery must be a finite number greater than or equal to 1.");
  }
  const zIndexes = /* @__PURE__ */ new Set();
  for (const node of state.nodes.values()) {
    validateNode(node, push);
    if (zIndexes.has(node.zIndex)) {
      push("node.zIndex.unique", `Node ${node.id} shares a z-index with another node.`);
    }
    zIndexes.add(node.zIndex);
  }
  for (const id of state.selection.values()) {
    if (!state.nodes.has(id)) {
      push("selection.exists", `Selected node ${id} does not exist.`);
    }
  }
  if (state.interaction.mode === "editing-text" && !state.nodes.has(state.interaction.nodeId)) {
    push("interaction.node", `Editing node ${state.interaction.nodeId} does not exist.`);
  }
  if (state.interaction.mode === "resizing-node" && !state.nodes.has(state.interaction.nodeId)) {
    push("interaction.node", `Resizing node ${state.interaction.nodeId} does not exist.`);
  }
  if (state.interaction.mode === "dragging-nodes") {
    for (const id of state.interaction.nodeIds) {
      if (!state.nodes.has(id)) {
        push("interaction.node", `Dragging node ${id} does not exist.`);
      }
    }
  }
  return failures;
}
function validateNode(node, push) {
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
    push("node.finite", `Node ${node.id} contains non-finite geometry.`);
  }
  if (node.width <= 0 || node.height <= 0) {
    push("node.size", `Node ${node.id} must have positive width and height.`);
  }
  if (!node.type) {
    push("node.type", `Node ${node.id} must have a type.`);
  }
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
function snapResizedBounds(bounds, handle, gridSize, constraints) {
  let { x, y, width, height } = bounds;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  if (handle.includes("e")) {
    width = snapSize(width, gridSize, constraints.minWidth);
  } else {
    x = snapValue(x, gridSize);
  }
  if (handle.includes("s")) {
    height = snapSize(height, gridSize, constraints.minHeight);
  } else {
    y = snapValue(y, gridSize);
  }
  if (handle.includes("w")) {
    width = snapSize(width, gridSize, constraints.minWidth);
    x = snapValue(right - width, gridSize);
    width = Math.max(constraints.minWidth, right - x);
  }
  if (handle.includes("n")) {
    height = snapSize(height, gridSize, constraints.minHeight);
    y = snapValue(bottom - height, gridSize);
    height = Math.max(constraints.minHeight, bottom - y);
  }
  return { x, y, width, height };
}

// src/engine.ts
var DEFAULT_CAMERA = { x: 0, y: 0, z: 1 };
var DEFAULT_ZOOM = { min: 0.1, max: 8 };
var DEFAULT_GRID = { size: 10, majorEvery: 5, snap: true, pattern: "line" };
var DEFAULT_NODE_CONSTRAINTS = {
  minWidth: 50,
  minHeight: 50,
  defaultWidth: 240,
  defaultHeight: 160
};
var DEFAULT_VIEWPORT_SIZE = { x: 1280, y: 720 };
function createCanvasEngine(options = {}) {
  const camera = { ...DEFAULT_CAMERA, ...options.camera };
  const zoom = { ...DEFAULT_ZOOM, ...options.zoom };
  const grid = { ...DEFAULT_GRID, ...options.grid };
  const nodeConstraints = { ...DEFAULT_NODE_CONSTRAINTS, ...options.nodes };
  const invariantMode = options.invariants ?? "strict";
  const diagnosticsEnabled = options.diagnostics !== false;
  const traceLimit = typeof options.diagnostics === "object" && options.diagnostics.traceLimit ? options.diagnostics.traceLimit : 500;
  const listeners = /* @__PURE__ */ new Map();
  const trace = [];
  const pluginCleanups = /* @__PURE__ */ new Map();
  const clipboard = [];
  let viewportSize = { ...DEFAULT_VIEWPORT_SIZE };
  let animationToken = 0;
  const state = {
    camera,
    nodes: /* @__PURE__ */ new Map(),
    selection: /* @__PURE__ */ new Set(),
    interaction: { mode: "idle" },
    nextZIndex: 1
  };
  for (const node of options.initialNodes ?? []) {
    const normalized = normalizeExistingNode(node);
    state.nodes.set(normalized.id, normalized);
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1);
  }
  function cloneNode(node) {
    return {
      ...node,
      data: structuredClone(node.data)
    };
  }
  function emit(event, ...args) {
    if (diagnosticsEnabled) {
      trace.push({ event, timestamp: Date.now(), args });
      if (trace.length > traceLimit) {
        trace.shift();
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      ;
      handler(...args);
    }
  }
  function on(event, handler) {
    const set = listeners.get(event) ?? /* @__PURE__ */ new Set();
    set.add(handler);
    listeners.set(event, set);
    return () => off(event, handler);
  }
  function once(event, handler) {
    const unsubscribe = on(event, ((...args) => {
      unsubscribe();
      handler(...args);
    }));
    return unsubscribe;
  }
  function off(event, handler) {
    listeners.get(event)?.delete(handler);
  }
  function getGridSettings() {
    return { ...grid };
  }
  function getViewportSize() {
    return { ...viewportSize };
  }
  function getSnapshot() {
    return createSnapshot(state, grid);
  }
  function runCommand(name, args, fn) {
    const started = performance.now();
    emit("command:before", name, args);
    const result = fn();
    validate(name);
    emit("command:after", name, args, performance.now() - started);
    return result;
  }
  async function runAsyncCommand(name, args, fn) {
    const started = performance.now();
    emit("command:before", name, args);
    const result = await fn();
    validate(name);
    emit("command:after", name, args, performance.now() - started);
    return result;
  }
  function validate(context) {
    if (invariantMode === "off") {
      return;
    }
    const failures = validateState(state, grid, context);
    for (const failure of failures) {
      emit("invariant:failed", failure);
    }
    if (failures.length > 0 && invariantMode === "strict") {
      throw new Error(`Canvas invariant failed in ${context}: ${failures[0]?.message}`);
    }
  }
  function setCamera(next) {
    const prev = { ...state.camera };
    if (prev.x === next.x && prev.y === next.y && prev.z === next.z) {
      return;
    }
    state.camera = next;
    emit("camera:change", { ...next }, prev);
  }
  function setSelection(nextSelection) {
    const prev = Array.from(state.selection.values());
    const next = Array.from(nextSelection);
    if (sameArray(prev, next)) {
      return;
    }
    state.selection = new Set(next);
    emit("selection:change", next, prev);
  }
  function setInteraction(next) {
    const prev = state.interaction;
    state.interaction = next;
    if (prev.mode === "idle" && next.mode !== "idle") {
      emit("interaction:start", next);
      return;
    }
    if (prev.mode !== "idle" && next.mode === "idle") {
      emit("interaction:end", prev);
      return;
    }
    if (prev.mode !== "idle" && next.mode !== "idle") {
      emit("interaction:update", next);
    }
  }
  function assertNode(id) {
    const node = state.nodes.get(id);
    if (!node) {
      throw new Error(`Node "${id}" does not exist.`);
    }
    return node;
  }
  function getNodeBounds(node) {
    return {
      minX: node.x,
      minY: node.y,
      maxX: node.x + node.width,
      maxY: node.y + node.height
    };
  }
  function normalizeExistingNode(node) {
    return {
      ...node,
      data: structuredClone(node.data),
      locked: Boolean(node.locked),
      visible: node.visible !== false
    };
  }
  function normalizeNode(input) {
    const rawPoint = {
      x: input.x ?? 0,
      y: input.y ?? 0
    };
    const snappedPoint = grid.snap ? snapPoint(rawPoint, grid.size) : rawPoint;
    const width = grid.snap ? snapSize(input.width ?? nodeConstraints.defaultWidth, grid.size, nodeConstraints.minWidth) : input.width ?? nodeConstraints.defaultWidth;
    const height = grid.snap ? snapSize(input.height ?? nodeConstraints.defaultHeight, grid.size, nodeConstraints.minHeight) : input.height ?? nodeConstraints.defaultHeight;
    return {
      id: input.id ?? crypto.randomUUID(),
      type: input.type ?? "text",
      x: snappedPoint.x,
      y: snappedPoint.y,
      width,
      height,
      data: structuredClone(
        input.data ?? ((input.type ?? "text") === "text" ? { content: "" } : {})
      ),
      zIndex: state.nextZIndex++,
      locked: Boolean(input.locked),
      visible: input.visible !== false
    };
  }
  function applyNodePatch(node, patch) {
    const next = {
      ...node,
      ...patch,
      data: patch.data === void 0 ? cloneNode(node).data : structuredClone(patch.data),
      visible: patch.visible ?? node.visible,
      locked: patch.locked ?? node.locked
    };
    if (grid.snap) {
      next.x = snapValue(next.x, grid.size);
      next.y = snapValue(next.y, grid.size);
      next.width = snapSize(next.width, grid.size, nodeConstraints.minWidth);
      next.height = snapSize(next.height, grid.size, nodeConstraints.minHeight);
    }
    return next;
  }
  function replaceNode(node, next) {
    state.nodes.set(node.id, next);
  }
  function duplicateNode(node, offset) {
    return {
      ...cloneNode(node),
      id: crypto.randomUUID(),
      x: grid.snap ? snapValue(node.x + offset.x, grid.size) : node.x + offset.x,
      y: grid.snap ? snapValue(node.y + offset.y, grid.size) : node.y + offset.y,
      zIndex: state.nextZIndex++
    };
  }
  function getSelectionNodes() {
    return Array.from(state.selection.values()).map((id) => state.nodes.get(id)).filter((node) => Boolean(node));
  }
  function cleanupSelection() {
    const next = Array.from(state.selection.values()).filter((id) => state.nodes.has(id));
    setSelection(next);
  }
  function getAnimationFrameDriver() {
    const raf = globalThis.requestAnimationFrame?.bind(globalThis);
    const caf = globalThis.cancelAnimationFrame?.bind(globalThis);
    if (typeof raf === "function" && typeof caf === "function") {
      return { raf, caf };
    }
    return {
      raf: (cb) => globalThis.setTimeout(() => cb(Date.now()), 16),
      caf: (handle) => globalThis.clearTimeout(handle)
    };
  }
  async function animateCamera(target) {
    animationToken += 1;
    const token = animationToken;
    const start = { ...state.camera };
    const started = performance.now();
    const duration = 280;
    const { raf } = getAnimationFrameDriver();
    await new Promise((resolve) => {
      const tick = () => {
        if (token !== animationToken) {
          resolve();
          return;
        }
        const elapsed = performance.now() - started;
        const t = clamp(elapsed / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setCamera(lerpCamera(start, target, eased));
        if (t < 1) {
          raf(tick);
        } else {
          resolve();
        }
      };
      raf(tick);
    });
  }
  function computeFitCamera(ids, padding = 40) {
    const source = ids ? ids.map((id) => state.nodes.get(id)).filter((node) => Boolean(node && node.visible)) : Array.from(state.nodes.values()).filter((node) => node.visible);
    if (source.length === 0) {
      return null;
    }
    const bounds = source.reduce((acc, node) => {
      const current = getNodeBounds(node);
      return {
        minX: Math.min(acc.minX, current.minX),
        minY: Math.min(acc.minY, current.minY),
        maxX: Math.max(acc.maxX, current.maxX),
        maxY: Math.max(acc.maxY, current.maxY)
      };
    }, getNodeBounds(source[0]));
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const zoomLevel = clamp(
      Math.min((viewportSize.x - padding * 2) / width, (viewportSize.y - padding * 2) / height),
      zoom.min,
      zoom.max
    );
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    return {
      x: viewportSize.x / (2 * zoomLevel) - center.x,
      y: viewportSize.y / (2 * zoomLevel) - center.y,
      z: zoomLevel
    };
  }
  function restoreSnapshot(snapshot, mode) {
    if (mode === "replace") {
      state.nodes = new Map(snapshot.nodes.map((node) => [node.id, normalizeExistingNode(node)]));
      state.selection = new Set(snapshot.selection.filter((id) => state.nodes.has(id)));
      state.interaction = { mode: "idle" };
      state.nextZIndex = snapshot.nextZIndex;
      setCamera({ ...snapshot.camera });
      grid.size = snapshot.grid.size;
      grid.majorEvery = snapshot.grid.majorEvery;
      grid.snap = snapshot.grid.snap;
      grid.pattern = snapshot.grid.pattern;
      return;
    }
    for (const rawNode of snapshot.nodes) {
      const node = normalizeExistingNode(rawNode);
      const id = state.nodes.has(node.id) ? crypto.randomUUID() : node.id;
      state.nodes.set(id, { ...node, id });
      state.nextZIndex = Math.max(state.nextZIndex, node.zIndex + 1);
    }
  }
  const engine = {
    getState() {
      return state;
    },
    getSnapshot,
    getGridSettings,
    getViewportSize,
    updateGridSettings(patch) {
      return runCommand("updateGridSettings", [patch], () => {
        if (patch.size !== void 0) {
          grid.size = Math.max(1, Math.round(patch.size));
        }
        if (patch.majorEvery !== void 0) {
          grid.majorEvery = Math.max(1, Math.round(patch.majorEvery));
        }
        if (patch.snap !== void 0) {
          grid.snap = patch.snap;
        }
        if (patch.pattern !== void 0) {
          grid.pattern = patch.pattern;
        }
        return getGridSettings();
      });
    },
    setViewportSize(size) {
      viewportSize = {
        x: Math.max(1, size.x),
        y: Math.max(1, size.y)
      };
    },
    emit,
    on,
    once,
    off,
    exportTrace() {
      return trace.slice();
    },
    use(plugin) {
      if (pluginCleanups.has(plugin.name)) {
        return;
      }
      const cleanup = plugin.install(engine);
      pluginCleanups.set(plugin.name, cleanup ?? (() => void 0));
    },
    screenToWorld(point) {
      return screenToWorld(point, state.camera);
    },
    worldToScreen(point) {
      return worldToScreen(point, state.camera);
    },
    getVisibleBounds(width, height) {
      return getVisibleBounds(width, height, state.camera);
    },
    getNodeAt(worldPoint) {
      const ordered = Array.from(state.nodes.values()).filter((node) => node.visible).sort((a, b) => b.zIndex - a.zIndex);
      return ordered.find((node) => pointInBounds(worldPoint, getNodeBounds(node))) ?? null;
    },
    getNodesInBounds(bounds) {
      return Array.from(state.nodes.values()).filter((node) => node.visible && boundsIntersect(getNodeBounds(node), bounds));
    },
    panBy(dx, dy) {
      runCommand("panBy", [dx, dy], () => {
        setCamera({
          x: state.camera.x - dx / state.camera.z,
          y: state.camera.y - dy / state.camera.z,
          z: state.camera.z
        });
      });
    },
    panTo(worldPoint, animated = false) {
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z };
      return runAsyncCommand("panTo", [worldPoint, animated], async () => {
        if (animated) {
          await animateCamera(target);
        } else {
          setCamera(target);
        }
      });
    },
    zoomAt(screenPoint, delta) {
      runCommand("zoomAt", [screenPoint, delta], () => {
        setCamera(zoomCameraAtScreenPoint(screenPoint, delta, state.camera, zoom.min, zoom.max));
      });
    },
    zoomTo(level, animated = false) {
      const clamped = clamp(level, zoom.min, zoom.max);
      const viewportCenter = {
        x: viewportSize.x / 2,
        y: viewportSize.y / 2
      };
      const centerWorld = screenToWorld(viewportCenter, state.camera);
      const target = {
        x: viewportCenter.x / clamped - centerWorld.x,
        y: viewportCenter.y / clamped - centerWorld.y,
        z: clamped
      };
      return runAsyncCommand("zoomTo", [level, animated], async () => {
        if (animated) {
          await animateCamera(target);
        } else {
          setCamera(target);
        }
      });
    },
    zoomToFit(padding = 40, animated = false) {
      return runAsyncCommand("zoomToFit", [padding, animated], async () => {
        const target = computeFitCamera(null, padding);
        if (!target) {
          return;
        }
        if (animated) {
          await animateCamera(target);
        } else {
          setCamera(target);
        }
      });
    },
    zoomToNodes(ids, padding = 40, animated = false) {
      return runAsyncCommand("zoomToNodes", [ids, padding, animated], async () => {
        const target = computeFitCamera(ids, padding);
        if (!target) {
          return;
        }
        if (animated) {
          await animateCamera(target);
        } else {
          setCamera(target);
        }
      });
    },
    createNode(input) {
      return runCommand("createNode", [input], () => {
        const node = normalizeNode(input);
        state.nodes.set(node.id, node);
        setSelection([node.id]);
        emit("node:created", cloneNode(node));
        return cloneNode(node);
      });
    },
    updateNode(id, patch) {
      return runCommand("updateNode", [id, patch], () => {
        const current = assertNode(id);
        const next = applyNodePatch(current, patch);
        replaceNode(current, next);
        emit("node:updated", cloneNode(next), cloneNode(current));
        return cloneNode(next);
      });
    },
    deleteNode(id) {
      runCommand("deleteNode", [id], () => {
        const node = assertNode(id);
        state.nodes.delete(id);
        cleanupSelection();
        if (state.interaction.mode !== "idle") {
          setInteraction({ mode: "idle" });
        }
        emit("node:deleted", id, cloneNode(node));
      });
    },
    moveNode(id, dx, dy) {
      return runCommand("moveNode", [id, dx, dy], () => {
        const node = assertNode(id);
        if (node.locked) {
          return cloneNode(node);
        }
        const prev = cloneNode(node);
        const next = {
          ...node,
          x: grid.snap ? snapValue(node.x + dx, grid.size) : node.x + dx,
          y: grid.snap ? snapValue(node.y + dy, grid.size) : node.y + dy
        };
        replaceNode(node, next);
        emit("node:moved", cloneNode(next), { x: next.x - prev.x, y: next.y - prev.y });
        emit("node:updated", cloneNode(next), prev);
        return cloneNode(next);
      });
    },
    resizeNode(id, handle, dx, dy) {
      return runCommand("resizeNode", [id, handle, dx, dy], () => {
        const node = assertNode(id);
        if (node.locked) {
          return cloneNode(node);
        }
        const prev = cloneNode(node);
        const raw = applyResizeDelta(node, handle, dx, dy, {
          minWidth: nodeConstraints.minWidth,
          minHeight: nodeConstraints.minHeight
        });
        const nextBounds = grid.snap ? snapResizedBounds(raw, handle, grid.size, {
          minWidth: nodeConstraints.minWidth,
          minHeight: nodeConstraints.minHeight
        }) : raw;
        const next = { ...node, ...nextBounds };
        replaceNode(node, next);
        emit("node:resized", cloneNode(next), {
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height
        });
        emit("node:updated", cloneNode(next), prev);
        return cloneNode(next);
      });
    },
    bringToFront(id) {
      runCommand("bringToFront", [id], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const next = { ...node, zIndex: state.nextZIndex++ };
        replaceNode(node, next);
        emit("node:updated", cloneNode(next), prev);
      });
    },
    sendToBack(id) {
      runCommand("sendToBack", [id], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const minZ = Math.min(...Array.from(state.nodes.values(), (entry) => entry.zIndex));
        const next = { ...node, zIndex: minZ - 1 };
        replaceNode(node, next);
        emit("node:updated", cloneNode(next), prev);
      });
    },
    lockNode(id) {
      runCommand("lockNode", [id], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const next = { ...node, locked: true };
        replaceNode(node, next);
        emit("node:updated", cloneNode(next), prev);
      });
    },
    unlockNode(id) {
      runCommand("unlockNode", [id], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const next = { ...node, locked: false };
        replaceNode(node, next);
        emit("node:updated", cloneNode(next), prev);
      });
    },
    duplicateNodes(ids, offset = { x: grid.size, y: grid.size }) {
      return runCommand("duplicateNodes", [ids, offset], () => {
        const created = ids.map((id) => state.nodes.get(id)).filter((node) => Boolean(node)).map((node) => duplicateNode(node, offset));
        for (const node of created) {
          state.nodes.set(node.id, node);
          emit("node:created", cloneNode(node));
        }
        setSelection(created.map((node) => node.id));
        return created.map(cloneNode);
      });
    },
    copySelected() {
      return runCommand("copySelected", [], () => {
        clipboard.length = 0;
        for (const node of getSelectionNodes()) {
          clipboard.push(cloneNode(node));
        }
        return clipboard.map(cloneNode);
      });
    },
    pasteClipboard(offset = { x: grid.size, y: grid.size }) {
      return runCommand("pasteClipboard", [offset], () => {
        const created = clipboard.map((node) => duplicateNode(node, offset));
        for (const node of created) {
          state.nodes.set(node.id, node);
          emit("node:created", cloneNode(node));
        }
        setSelection(created.map((node) => node.id));
        return created.map(cloneNode);
      });
    },
    select(ids, mode = "replace") {
      runCommand("select", [ids, mode], () => {
        const resolved = Array.isArray(ids) ? ids : [ids];
        if (mode === "replace") {
          setSelection(resolved);
          return;
        }
        const next = new Set(state.selection);
        for (const id of resolved) {
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
        setSelection(next);
      });
    },
    selectAll() {
      runCommand("selectAll", [], () => {
        setSelection(Array.from(state.nodes.values()).filter((node) => node.visible).map((node) => node.id));
      });
    },
    clearSelection() {
      runCommand("clearSelection", [], () => {
        setSelection([]);
      });
    },
    deleteSelected() {
      runCommand("deleteSelected", [], () => {
        const deleting = getSelectionNodes().filter((node) => !node.locked);
        for (const node of deleting) {
          state.nodes.delete(node.id);
          emit("node:deleted", node.id, cloneNode(node));
        }
        setSelection([]);
        setInteraction({ mode: "idle" });
      });
    },
    getSelection() {
      return Array.from(state.selection.values());
    },
    beginPan(pointerId, screenPoint) {
      runCommand("beginPan", [pointerId, screenPoint], () => {
        setInteraction({
          mode: "panning",
          pointerId,
          lastScreenPoint: { ...screenPoint }
        });
      });
    },
    beginNodeDrag(id, pointerId, screenPoint) {
      runCommand("beginNodeDrag", [id, pointerId, screenPoint], () => {
        const node = assertNode(id);
        if (node.locked) {
          return;
        }
        const nodeIds = state.selection.has(id) ? getSelectionNodes().filter((entry) => !entry.locked).map((entry) => entry.id) : [id];
        if (!state.selection.has(id)) {
          setSelection([id]);
        }
        const startNodePositions = Object.fromEntries(
          nodeIds.map((nodeId) => {
            const current = assertNode(nodeId);
            return [nodeId, { x: current.x, y: current.y }];
          })
        );
        setInteraction({
          mode: "dragging-nodes",
          pointerId,
          nodeIds,
          startScreenPoint: { ...screenPoint },
          startNodePositions
        });
        engine.bringToFront(id);
      });
    },
    beginResize(id, handle, pointerId, screenPoint) {
      runCommand("beginResize", [id, handle, pointerId, screenPoint], () => {
        const node = assertNode(id);
        if (node.locked) {
          return;
        }
        setSelection([id]);
        setInteraction({
          mode: "resizing-node",
          pointerId,
          nodeId: id,
          handle,
          startScreenPoint: { ...screenPoint },
          startNodeBounds: {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
          }
        });
        engine.bringToFront(id);
      });
    },
    beginBoxSelect(pointerId, screenPoint) {
      runCommand("beginBoxSelect", [pointerId, screenPoint], () => {
        const worldPoint = engine.screenToWorld(screenPoint);
        setSelection([]);
        setInteraction({
          mode: "box-select",
          pointerId,
          startScreenPoint: { ...screenPoint },
          currentScreenPoint: { ...screenPoint },
          startWorldPoint: worldPoint,
          currentWorldPoint: worldPoint
        });
      });
    },
    beginTextEdit(id) {
      runCommand("beginTextEdit", [id], () => {
        assertNode(id);
        setSelection([id]);
        setInteraction({ mode: "editing-text", nodeId: id });
      });
    },
    commitTextEdit(id, text) {
      return runCommand("commitTextEdit", [id, text], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const data = typeof node.data === "object" && node.data !== null ? structuredClone(node.data) : {};
        data.content = text;
        const next = { ...node, data };
        replaceNode(node, next);
        setInteraction({ mode: "idle" });
        emit("node:updated", cloneNode(next), prev);
        return cloneNode(next);
      });
    },
    updatePointer(pointerId, screenPoint) {
      const interaction = state.interaction;
      if (interaction.mode === "idle" || interaction.mode === "editing-text" || interaction.pointerId !== pointerId) {
        return;
      }
      if (interaction.mode === "panning") {
        runCommand("updatePointer", [pointerId, screenPoint], () => {
          const deltaX = screenPoint.x - interaction.lastScreenPoint.x;
          const deltaY = screenPoint.y - interaction.lastScreenPoint.y;
          setCamera({
            x: state.camera.x + deltaX / state.camera.z,
            y: state.camera.y + deltaY / state.camera.z,
            z: state.camera.z
          });
          interaction.lastScreenPoint = { ...screenPoint };
        });
        return;
      }
      if (interaction.mode === "dragging-nodes") {
        runCommand("updatePointer", [pointerId, screenPoint], () => {
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z;
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z;
          for (const nodeId of interaction.nodeIds) {
            const node = assertNode(nodeId);
            const origin = interaction.startNodePositions[nodeId];
            const next = {
              ...node,
              x: grid.snap ? snapValue(origin.x + deltaX, grid.size) : origin.x + deltaX,
              y: grid.snap ? snapValue(origin.y + deltaY, grid.size) : origin.y + deltaY
            };
            replaceNode(node, next);
            emit("node:moved", cloneNode(next), { x: next.x - origin.x, y: next.y - origin.y });
          }
        });
        return;
      }
      if (interaction.mode === "resizing-node") {
        runCommand("updatePointer", [pointerId, screenPoint], () => {
          const node = assertNode(interaction.nodeId);
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z;
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z;
          const raw = applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, {
            minWidth: nodeConstraints.minWidth,
            minHeight: nodeConstraints.minHeight
          });
          const nextBounds = grid.snap ? snapResizedBounds(raw, interaction.handle, grid.size, {
            minWidth: nodeConstraints.minWidth,
            minHeight: nodeConstraints.minHeight
          }) : raw;
          replaceNode(node, { ...node, ...nextBounds });
        });
        return;
      }
      runCommand("updatePointer", [pointerId, screenPoint], () => {
        const currentWorldPoint = engine.screenToWorld(screenPoint);
        interaction.currentScreenPoint = { ...screenPoint };
        interaction.currentWorldPoint = currentWorldPoint;
        const bounds = getBoundsFromPoints(interaction.startWorldPoint, currentWorldPoint);
        const matches = engine.getNodesInBounds(bounds).filter((node) => node.visible).map((node) => node.id);
        setSelection(matches);
      });
    },
    endInteraction(pointerId) {
      const interaction = state.interaction;
      if (interaction.mode === "idle") {
        return;
      }
      if ("pointerId" in interaction && pointerId !== void 0 && interaction.pointerId !== pointerId) {
        return;
      }
      runCommand("endInteraction", [pointerId], () => {
        setInteraction({ mode: "idle" });
      });
    },
    exportJSON() {
      return JSON.stringify(getSnapshot());
    },
    importJSON(json, mode = "replace") {
      runCommand("importJSON", [mode], () => {
        const parsed = JSON.parse(json);
        restoreSnapshot(parsed, mode);
      });
    }
  };
  for (const plugin of options.plugins ?? []) {
    engine.use(plugin);
  }
  validate("createCanvasEngine");
  emit("ready");
  return engine;
}
function sameArray(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}
export {
  applyResizeDelta,
  boundsContain,
  boundsIntersect,
  clamp,
  createCanvasEngine,
  getBoundsFromPoints,
  getVisibleBounds,
  lerp,
  lerpCamera,
  pointInBounds,
  screenToWorld,
  snapBounds,
  snapPoint,
  snapResizedBounds,
  snapSize,
  snapValue,
  worldToScreen,
  zoomCameraAtScreenPoint
};
