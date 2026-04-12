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

// src/hierarchy.ts
function getBoundsFromNode(node) {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + node.width,
    maxY: node.y + node.height
  };
}
function groupArea(node) {
  return node.width * node.height;
}
function addDescendants(rootId, nodes, out) {
  for (const n of nodes.values()) {
    if (n.parentId === rootId && !out.has(n.id)) {
      out.add(n.id);
      if (n.type === "group") {
        addDescendants(n.id, nodes, out);
      }
    }
  }
}
function expandGroupDragSeeds(seedIds, nodes) {
  const out = /* @__PURE__ */ new Set();
  for (const id of seedIds) {
    out.add(id);
    const n = nodes.get(id);
    if (n?.type === "group") {
      addDescendants(id, nodes, out);
    }
  }
  return out;
}
function collectSubtreeIds(rootId, nodes, into) {
  into.add(rootId);
  for (const n of nodes.values()) {
    if (n.parentId === rootId) {
      collectSubtreeIds(n.id, nodes, into);
    }
  }
}
function collectUniformTranslationTargets(seedIds, nodes) {
  const expanded = expandGroupDragSeeds(seedIds, nodes);
  const roots = [];
  for (const id of expanded) {
    const n = nodes.get(id);
    if (!n) {
      continue;
    }
    if (!n.parentId || !expanded.has(n.parentId)) {
      roots.push(id);
    }
  }
  const out = /* @__PURE__ */ new Set();
  for (const r of roots) {
    collectSubtreeIds(r, nodes, out);
  }
  return [...out];
}
function isStrictDescendantOf(maybeDescendant, ancestorId, nodes) {
  let walk = nodes.get(maybeDescendant)?.parentId;
  const seen = /* @__PURE__ */ new Set();
  while (walk) {
    if (seen.has(walk)) {
      return false;
    }
    seen.add(walk);
    if (walk === ancestorId) {
      return true;
    }
    walk = nodes.get(walk)?.parentId;
  }
  return false;
}
function findContainingGroup(node, nodes) {
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  const candidates = [];
  for (const g of nodes.values()) {
    if (g.type !== "group" || !g.visible) {
      continue;
    }
    if (g.id === node.id) {
      continue;
    }
    if (isStrictDescendantOf(g.id, node.id, nodes)) {
      continue;
    }
    if (!pointInBounds(center, getBoundsFromNode(g))) {
      continue;
    }
    candidates.push(g);
  }
  if (candidates.length === 0) {
    return void 0;
  }
  candidates.sort((a, b) => groupArea(a) - groupArea(b));
  return candidates[0].id;
}
function sortIdsByZIndex(ids, nodes) {
  return [...ids].sort((a, b) => {
    const za = nodes.get(a)?.zIndex ?? 0;
    const zb = nodes.get(b)?.zIndex ?? 0;
    return za - zb;
  });
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
        startNodeBounds: { ...interaction.startNodeBounds },
        aspectRatio: interaction.aspectRatio
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
    snapGuides: [...state.snapGuides],
    nextZIndex: state.nextZIndex
  };
}
function cloneData(data) {
  return structuredClone(data);
}
function validateState(state, grid, context) {
  const failures = [];
  let snapshot = null;
  const lazySnapshot = () => snapshot ?? (snapshot = createSnapshot(state, grid));
  const push = (name, message) => {
    failures.push({ name, message, context, snapshot: lazySnapshot() });
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
    validateNodeParent(node, state, push);
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
function validateNodeParent(node, state, push) {
  if (node.parentId === void 0) {
    return;
  }
  if (node.parentId === node.id) {
    push("node.parentId", `Node ${node.id} cannot be its own parent.`);
    return;
  }
  const parent = state.nodes.get(node.parentId);
  if (!parent) {
    push("node.parentId", `Node ${node.id} references missing parent ${node.parentId}.`);
    return;
  }
  if (parent.type !== "group") {
    push("node.parentId", `Node ${node.id} parent must be type "group", got "${parent.type}".`);
  }
  let walk = parent;
  const seen = /* @__PURE__ */ new Set();
  while (walk) {
    if (seen.has(walk.id)) {
      push("node.parentId", `Cycle detected in parent chain for node ${node.id}.`);
      return;
    }
    seen.add(walk.id);
    if (walk.id === node.id) {
      push("node.parentId", `Node ${node.id} would create a cycle in the parent chain.`);
      return;
    }
    if (!walk.parentId) {
      break;
    }
    walk = state.nodes.get(walk.parentId);
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
function applyResizeDeltaLocked(node, handle, deltaX, deltaY, constraints, aspectRatio) {
  const { width: w, height: h } = node;
  let cdx = deltaX;
  let cdy = deltaY;
  let effectiveHandle = handle;
  if (handle === "e") {
    const newW = Math.max(constraints.minWidth, w + deltaX);
    cdx = newW - w;
    cdy = Math.max(constraints.minHeight, newW / aspectRatio) - h;
    effectiveHandle = "se";
  } else if (handle === "w") {
    const newW = Math.max(constraints.minWidth, w - deltaX);
    cdy = Math.max(constraints.minHeight, newW / aspectRatio) - h;
    effectiveHandle = "sw";
  } else if (handle === "s") {
    const newH = Math.max(constraints.minHeight, h + deltaY);
    cdy = newH - h;
    cdx = Math.max(constraints.minWidth, newH * aspectRatio) - w;
    effectiveHandle = "se";
  } else if (handle === "n") {
    const newH = Math.max(constraints.minHeight, h - deltaY);
    cdx = Math.max(constraints.minWidth, newH * aspectRatio) - w;
    effectiveHandle = "ne";
  } else {
    const xSign = handle.includes("e") ? 1 : -1;
    const ySign = handle.includes("s") ? 1 : -1;
    const growX = xSign * deltaX;
    const growY = ySign * deltaY;
    let newW;
    let newH;
    if (Math.abs(growX / w) >= Math.abs(growY / h)) {
      newW = Math.max(constraints.minWidth, w + growX);
      newH = Math.max(constraints.minHeight, newW / aspectRatio);
    } else {
      newH = Math.max(constraints.minHeight, h + growY);
      newW = Math.max(constraints.minWidth, newH * aspectRatio);
    }
    cdx = xSign * (newW - w);
    cdy = ySign * (newH - h);
  }
  return applyResizeDelta(node, effectiveHandle, cdx, cdy, constraints);
}
function snapResizedBoundsLocked(bounds, startBounds, handle, gridSize, constraints, aspectRatio) {
  const right = startBounds.x + startBounds.width;
  const bottom = startBounds.y + startBounds.height;
  if (handle === "n" || handle === "s") {
    const snappedH2 = snapSize(bounds.height, gridSize, constraints.minHeight);
    const snappedW2 = Math.max(constraints.minWidth, snappedH2 * aspectRatio);
    const y2 = handle === "n" ? bottom - snappedH2 : bounds.y;
    return { x: bounds.x, y: y2, width: snappedW2, height: snappedH2 };
  }
  const snappedW = snapSize(bounds.width, gridSize, constraints.minWidth);
  const snappedH = Math.max(constraints.minHeight, snappedW / aspectRatio);
  const x = handle.includes("w") ? right - snappedW : bounds.x;
  const y = handle.includes("n") ? bottom - snappedH : bounds.y;
  return { x, y, width: snappedW, height: snappedH };
}

// src/snap.ts
function collectNodeEdges(node) {
  const right = node.x + node.width;
  const bottom = node.y + node.height;
  return [
    { axis: "x", value: node.x, extentMin: node.y, extentMax: bottom },
    { axis: "x", value: right, extentMin: node.y, extentMax: bottom },
    { axis: "y", value: node.y, extentMin: node.x, extentMax: right },
    { axis: "y", value: bottom, extentMin: node.x, extentMax: right }
  ];
}
function collectOtherNodeEdges(nodes, excludeId) {
  const edges = [];
  for (const node of nodes) {
    if (node.id === excludeId || !node.visible) continue;
    edges.push(...collectNodeEdges(node));
  }
  return edges;
}
function collectOtherNodeEdgesExcluding(nodes, excludeIds) {
  const edges = [];
  for (const node of nodes) {
    if (excludeIds.has(node.id) || !node.visible) continue;
    edges.push(...collectNodeEdges(node));
  }
  return edges;
}
function findBestSnap(activeValue, activeExtentMin, activeExtentMax, axis, candidates, threshold) {
  let bestDist = threshold;
  let bestCandidate = null;
  for (const candidate of candidates) {
    if (candidate.axis !== axis) continue;
    const dist = Math.abs(candidate.value - activeValue);
    if (dist < bestDist) {
      bestDist = dist;
      bestCandidate = candidate;
    }
  }
  if (!bestCandidate) return null;
  const guideFrom = Math.min(activeExtentMin, bestCandidate.extentMin);
  const guideTo = Math.max(activeExtentMax, bestCandidate.extentMax);
  return {
    snappedValue: bestCandidate.value,
    guide: {
      axis,
      position: bestCandidate.value,
      from: guideFrom,
      to: guideTo
    }
  };
}
function snapBoundsToEdges(bounds, handle, otherEdges, threshold) {
  let { x, y, width, height } = bounds;
  const guides = [];
  const right = x + width;
  const bottom = y + height;
  if (handle.includes("e")) {
    const snap = findBestSnap(right, y, bottom, "x", otherEdges, threshold);
    if (snap) {
      width = snap.snappedValue - x;
      guides.push(snap.guide);
    }
  }
  if (handle.includes("w")) {
    const snap = findBestSnap(x, y, bottom, "x", otherEdges, threshold);
    if (snap) {
      const oldRight = x + width;
      x = snap.snappedValue;
      width = oldRight - x;
      guides.push(snap.guide);
    }
  }
  if (handle.includes("s")) {
    const snap = findBestSnap(bottom, x, right, "y", otherEdges, threshold);
    if (snap) {
      height = snap.snappedValue - y;
      guides.push(snap.guide);
    }
  }
  if (handle.includes("n")) {
    const snap = findBestSnap(y, x, right, "y", otherEdges, threshold);
    if (snap) {
      const oldBottom = y + height;
      y = snap.snappedValue;
      height = oldBottom - y;
      guides.push(snap.guide);
    }
  }
  return { bounds: { x, y, width, height }, guides };
}
function snapPositionToEdges(bounds, otherEdges, threshold) {
  let dx = 0;
  let dy = 0;
  const guides = [];
  const { x, y, width, height } = bounds;
  const right = x + width;
  const bottom = y + height;
  const snapLeft = findBestSnap(x, y, bottom, "x", otherEdges, threshold);
  const snapRight = findBestSnap(right, y, bottom, "x", otherEdges, threshold);
  if (snapLeft && snapRight) {
    const distLeft = Math.abs(snapLeft.snappedValue - x);
    const distRight = Math.abs(snapRight.snappedValue - right);
    if (distLeft <= distRight) {
      dx = snapLeft.snappedValue - x;
      guides.push(snapLeft.guide);
    } else {
      dx = snapRight.snappedValue - right;
      guides.push(snapRight.guide);
    }
  } else if (snapLeft) {
    dx = snapLeft.snappedValue - x;
    guides.push(snapLeft.guide);
  } else if (snapRight) {
    dx = snapRight.snappedValue - right;
    guides.push(snapRight.guide);
  }
  const snapTop = findBestSnap(y, x + dx, right + dx, "y", otherEdges, threshold);
  const snapBottom = findBestSnap(bottom, x + dx, right + dx, "y", otherEdges, threshold);
  if (snapTop && snapBottom) {
    const distTop = Math.abs(snapTop.snappedValue - y);
    const distBottom = Math.abs(snapBottom.snappedValue - bottom);
    if (distTop <= distBottom) {
      dy = snapTop.snappedValue - y;
      guides.push(snapTop.guide);
    } else {
      dy = snapBottom.snappedValue - bottom;
      guides.push(snapBottom.guide);
    }
  } else if (snapTop) {
    dy = snapTop.snappedValue - y;
    guides.push(snapTop.guide);
  } else if (snapBottom) {
    dy = snapBottom.snappedValue - bottom;
    guides.push(snapBottom.guide);
  }
  return { dx, dy, guides };
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
  let cachedNodeArray = null;
  const state = {
    camera,
    nodes: /* @__PURE__ */ new Map(),
    selection: /* @__PURE__ */ new Set(),
    interaction: { mode: "idle" },
    snapGuides: [],
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
      try {
        ;
        handler(...args);
      } catch (error) {
        console.error(`[canvas] handler for "${String(event)}" threw:`, error);
      }
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
  function invalidateNodeCache() {
    cachedNodeArray = null;
  }
  function getSnapshot() {
    if (!cachedNodeArray) {
      cachedNodeArray = Array.from(state.nodes.values()).map((node) => ({ ...node, data: structuredClone(node.data) })).sort((a, b) => a.zIndex - b.zIndex);
    }
    return {
      camera: { ...state.camera },
      grid: { ...grid },
      nodes: cachedNodeArray,
      selection: Array.from(state.selection.values()),
      interaction: cloneInteraction(state.interaction),
      snapGuides: [...state.snapGuides],
      nextZIndex: state.nextZIndex
    };
  }
  function runCommand(name, args, fn, skipValidation = false) {
    const started = performance.now();
    emit("command:before", name, args);
    const result = fn();
    if (!skipValidation) {
      validate(name);
    }
    emit("command:after", name, args, performance.now() - started);
    return result;
  }
  async function runAsyncCommand(name, args, fn, skipValidation = false) {
    const started = performance.now();
    emit("command:before", name, args);
    try {
      const result = await fn();
      if (!skipValidation) {
        validate(name);
      }
      emit("command:after", name, args, performance.now() - started);
      return result;
    } catch (error) {
      if (error instanceof AnimationCancelled) {
        return void 0;
      }
      throw error;
    }
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
  function normalizeExistingNode(node) {
    const parentId = typeof node.parentId === "string" && node.parentId.length > 0 ? node.parentId : void 0;
    return {
      ...node,
      data: structuredClone(node.data),
      locked: Boolean(node.locked),
      visible: node.visible !== false,
      parentId
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
    const t = input.type ?? "text";
    const defaultData = t === "text" ? { content: "" } : t === "group" ? { title: "Untitled group", accent: "#0d9488" } : {};
    const parentId = typeof input.parentId === "string" && input.parentId.length > 0 ? input.parentId : void 0;
    return {
      id: input.id ?? crypto.randomUUID(),
      type: t,
      x: snappedPoint.x,
      y: snappedPoint.y,
      width,
      height,
      data: structuredClone(input.data ?? defaultData),
      zIndex: state.nextZIndex++,
      locked: Boolean(input.locked),
      visible: input.visible !== false,
      parentId
    };
  }
  function applyNodePatch(node, patch) {
    const next = {
      ...node,
      ...patch,
      parentId: "parentId" in patch ? patch.parentId : node.parentId,
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
    invalidateNodeCache();
  }
  function bumpNodeToFront(id) {
    const node = state.nodes.get(id);
    if (!node) {
      return;
    }
    const prev = cloneNode(node);
    const next = { ...node, zIndex: state.nextZIndex++ };
    state.nodes.set(id, next);
    invalidateNodeCache();
    emit("node:updated", cloneNode(next), prev);
    restackGroupDescendantsAbove(id);
  }
  function restackGroupDescendantsAbove(groupId) {
    const g = state.nodes.get(groupId);
    if (!g || g.type !== "group") {
      return;
    }
    for (const child of getDirectChildren(groupId)) {
      fixSubtreeZOrderAfter(g, child.id);
    }
  }
  function getDirectChildren(parentId) {
    return [...state.nodes.values()].filter((n) => n.parentId === parentId);
  }
  function collectSubtreeIdSet(rootId, into) {
    collectSubtreeIds(rootId, state.nodes, into);
  }
  function forestIdsFromSeeds(seedIds) {
    const out = /* @__PURE__ */ new Set();
    for (const id of seedIds) {
      if (state.nodes.has(id)) {
        collectSubtreeIdSet(id, out);
      }
    }
    return out;
  }
  function deletionOrderPostOrder(ids) {
    const memo = /* @__PURE__ */ new Map();
    function depthOf(id) {
      const hit = memo.get(id);
      if (hit !== void 0) {
        return hit;
      }
      const n = state.nodes.get(id);
      if (!n?.parentId || !ids.has(n.parentId)) {
        memo.set(id, 0);
        return 0;
      }
      const d = depthOf(n.parentId) + 1;
      memo.set(id, d);
      return d;
    }
    return [...ids].sort((a, b) => depthOf(b) - depthOf(a));
  }
  function fixSubtreeZOrderAfter(parent, nodeId) {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return;
    }
    let cur = node;
    if (parent && cur.zIndex <= parent.zIndex) {
      cur = { ...cur, zIndex: state.nextZIndex++ };
      replaceNode(node, cur);
    }
    const anchor = state.nodes.get(nodeId);
    for (const child of getDirectChildren(nodeId)) {
      fixSubtreeZOrderAfter(anchor, child.id);
    }
  }
  function reparentAfterDrag(movedIds) {
    const ordered = sortIdsByZIndex(movedIds, state.nodes);
    for (const id of ordered) {
      const n = state.nodes.get(id);
      if (!n) {
        continue;
      }
      const nextParent = findContainingGroup(n, state.nodes);
      const prevParent = n.parentId;
      if (nextParent === prevParent) {
        continue;
      }
      const prev = cloneNode(n);
      const next = { ...n, parentId: nextParent };
      replaceNode(n, next);
      const placed = state.nodes.get(id);
      emit("node:updated", cloneNode(placed), prev);
      const pNode = nextParent ? assertNode(nextParent) : null;
      fixSubtreeZOrderAfter(pNode, id);
    }
  }
  function getCopyClosureNodes() {
    const selected = getSelectionNodes();
    const ids = expandGroupDragSeeds(
      selected.map((n) => n.id),
      state.nodes
    );
    return [...ids].map((nid) => state.nodes.get(nid)).filter((node) => Boolean(node)).sort((a, b) => a.zIndex - b.zIndex);
  }
  function duplicateForest(nodes, offset) {
    const sorted = [...nodes].sort((a, b) => a.zIndex - b.zIndex);
    const idMap = /* @__PURE__ */ new Map();
    for (const n of sorted) {
      idMap.set(n.id, crypto.randomUUID());
    }
    const created = [];
    for (const n of sorted) {
      const newId = idMap.get(n.id);
      const mappedParent = n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : void 0;
      const dup = {
        ...cloneNode(n),
        id: newId,
        parentId: mappedParent,
        x: grid.snap ? snapValue(n.x + offset.x, grid.size) : n.x + offset.x,
        y: grid.snap ? snapValue(n.y + offset.y, grid.size) : n.y + offset.y,
        zIndex: state.nextZIndex++
      };
      created.push(dup);
    }
    return created;
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
  class AnimationCancelled extends Error {
    constructor() {
      super("Animation cancelled");
      this.name = "AnimationCancelled";
    }
  }
  async function animateCamera(target) {
    animationToken += 1;
    const token = animationToken;
    const start = { ...state.camera };
    const started = performance.now();
    const duration = 280;
    const { raf } = getAnimationFrameDriver();
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (token !== animationToken) {
          reject(new AnimationCancelled());
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
      const current = getBoundsFromNode(node);
      return {
        minX: Math.min(acc.minX, current.minX),
        minY: Math.min(acc.minY, current.minY),
        maxX: Math.max(acc.maxX, current.maxX),
        maxY: Math.max(acc.maxY, current.maxY)
      };
    }, getBoundsFromNode(source[0]));
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
      invalidateNodeCache();
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
      state.nodes.set(id, { ...node, id, zIndex: state.nextZIndex++ });
    }
    invalidateNodeCache();
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
      let best = null;
      let bestZ = -Infinity;
      for (const node of state.nodes.values()) {
        if (node.visible && node.zIndex > bestZ && pointInBounds(worldPoint, getBoundsFromNode(node))) {
          best = node;
          bestZ = node.zIndex;
        }
      }
      return best;
    },
    getNodesInBounds(bounds) {
      return Array.from(state.nodes.values()).filter((node) => node.visible && boundsIntersect(getBoundsFromNode(node), bounds));
    },
    panBy(dx, dy) {
      runCommand("panBy", [dx, dy], () => {
        setCamera({
          x: state.camera.x - dx / state.camera.z,
          y: state.camera.y - dy / state.camera.z,
          z: state.camera.z
        });
      }, true);
    },
    panTo(worldPoint, animated = false) {
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z };
      return runAsyncCommand("panTo", [worldPoint, animated], async () => {
        if (animated) {
          await animateCamera(target);
        } else {
          setCamera(target);
        }
      }, true);
    },
    zoomAt(screenPoint, delta) {
      runCommand("zoomAt", [screenPoint, delta], () => {
        setCamera(zoomCameraAtScreenPoint(screenPoint, delta, state.camera, zoom.min, zoom.max));
      }, true);
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
      }, true);
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
      }, true);
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
      }, true);
    },
    createNode(input) {
      return runCommand("createNode", [input], () => {
        const node = normalizeNode(input);
        state.nodes.set(node.id, node);
        invalidateNodeCache();
        if (input.select !== false) {
          setSelection([node.id]);
        }
        const cloned = cloneNode(node);
        emit("node:created", cloned);
        return cloned;
      });
    },
    updateNode(id, patch) {
      return runCommand("updateNode", [id, patch], () => {
        const current = assertNode(id);
        const next = applyNodePatch(current, patch);
        replaceNode(current, next);
        const clonedNext = cloneNode(next);
        const clonedCurrent = cloneNode(current);
        emit("node:updated", clonedNext, clonedCurrent);
        return clonedNext;
      });
    },
    deleteNode(id) {
      runCommand("deleteNode", [id], () => {
        assertNode(id);
        const toDel = /* @__PURE__ */ new Set();
        collectSubtreeIdSet(id, toDel);
        const order = deletionOrderPostOrder(toDel);
        for (const delId of order) {
          const prevNode = state.nodes.get(delId);
          if (!prevNode) {
            continue;
          }
          state.nodes.delete(delId);
          emit("node:deleted", delId, cloneNode(prevNode));
        }
        invalidateNodeCache();
        cleanupSelection();
        if (state.interaction.mode !== "idle") {
          setInteraction({ mode: "idle" });
        }
      });
    },
    moveNode(id, dx, dy) {
      return runCommand("moveNode", [id, dx, dy], () => {
        const node = assertNode(id);
        if (node.locked) {
          return cloneNode(node);
        }
        const targets = collectUniformTranslationTargets([id], state.nodes);
        for (const tid of targets) {
          const n = assertNode(tid);
          const prev = cloneNode(n);
          const next = {
            ...n,
            x: grid.snap ? snapValue(n.x + dx, grid.size) : n.x + dx,
            y: grid.snap ? snapValue(n.y + dy, grid.size) : n.y + dy
          };
          replaceNode(n, next);
          const moved = cloneNode(next);
          emit("node:moved", moved, { x: next.x - prev.x, y: next.y - prev.y });
          emit("node:updated", moved, prev);
        }
        reparentAfterDrag(targets);
        return cloneNode(assertNode(id));
      });
    },
    translateSelectedNodes(dx, dy) {
      runCommand("translateSelectedNodes", [dx, dy], () => {
        const seeds = Array.from(state.selection.values()).filter((sid) => {
          const n = state.nodes.get(sid);
          return n && !n.locked;
        });
        if (seeds.length === 0) {
          return;
        }
        const targets = collectUniformTranslationTargets(seeds, state.nodes);
        for (const tid of targets) {
          const n = assertNode(tid);
          const prev = cloneNode(n);
          const next = {
            ...n,
            x: grid.snap ? snapValue(n.x + dx, grid.size) : n.x + dx,
            y: grid.snap ? snapValue(n.y + dy, grid.size) : n.y + dy
          };
          replaceNode(n, next);
          const cloned = cloneNode(next);
          emit("node:moved", cloned, { x: next.x - prev.x, y: next.y - prev.y });
          emit("node:updated", cloned, prev);
        }
        reparentAfterDrag(targets);
      });
    },
    resizeNode(id, handle, dx, dy) {
      return runCommand("resizeNode", [id, handle, dx, dy], () => {
        const node = assertNode(id);
        if (node.locked) {
          return cloneNode(node);
        }
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
        const cloned = cloneNode(next);
        const prev = cloneNode(node);
        emit("node:resized", cloned, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        });
        emit("node:updated", cloned, prev);
        return cloned;
      });
    },
    bringToFront(id) {
      runCommand("bringToFront", [id], () => {
        const node = assertNode(id);
        const prev = cloneNode(node);
        const next = { ...node, zIndex: state.nextZIndex++ };
        replaceNode(node, next);
        emit("node:updated", cloneNode(next), prev);
        restackGroupDescendantsAbove(id);
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
        restackGroupDescendantsAbove(id);
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
        const forest = forestIdsFromSeeds(ids);
        const source = [...forest].map((nid) => state.nodes.get(nid)).filter((node) => Boolean(node)).sort((a, b) => a.zIndex - b.zIndex);
        const created = duplicateForest(source, offset);
        for (const node of created) {
          state.nodes.set(node.id, node);
          emit("node:created", cloneNode(node));
        }
        invalidateNodeCache();
        setSelection(created.map((node) => node.id));
        return created.map(cloneNode);
      });
    },
    copySelected() {
      return runCommand("copySelected", [], () => {
        clipboard.length = 0;
        for (const node of getCopyClosureNodes()) {
          clipboard.push(cloneNode(node));
        }
        return clipboard.map(cloneNode);
      });
    },
    pasteClipboard(offset = { x: grid.size, y: grid.size }) {
      return runCommand("pasteClipboard", [offset], () => {
        const created = duplicateForest(clipboard, offset);
        for (const node of created) {
          state.nodes.set(node.id, node);
          emit("node:created", cloneNode(node));
        }
        invalidateNodeCache();
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
        const deletingRoots = getSelectionNodes().filter((node) => !node.locked);
        const toDel = /* @__PURE__ */ new Set();
        for (const n of deletingRoots) {
          collectSubtreeIdSet(n.id, toDel);
        }
        const order = deletionOrderPostOrder(toDel);
        for (const delId of order) {
          const prevNode = state.nodes.get(delId);
          if (!prevNode) {
            continue;
          }
          state.nodes.delete(delId);
          emit("node:deleted", delId, cloneNode(prevNode));
        }
        if (toDel.size > 0) {
          invalidateNodeCache();
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
        const initialSelection = state.selection.has(id) ? getSelectionNodes().filter((entry) => !entry.locked).map((entry) => entry.id) : [id];
        const nodeIds = collectUniformTranslationTargets(initialSelection, state.nodes);
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
        bumpNodeToFront(id);
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
          },
          aspectRatio: node.width / node.height
        });
        bumpNodeToFront(id);
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
        let next;
        if (text !== void 0) {
          const data = typeof node.data === "object" && node.data !== null ? structuredClone(node.data) : {};
          data.content = text;
          next = { ...node, data };
          replaceNode(node, next);
          emit("node:updated", cloneNode(next), prev);
        } else {
          next = node;
        }
        setInteraction({ mode: "idle" });
        return cloneNode(next);
      });
    },
    updatePointer(pointerId, screenPoint, modifiers) {
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
        }, true);
        return;
      }
      if (interaction.mode === "dragging-nodes") {
        runCommand("updatePointer", [pointerId, screenPoint], () => {
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z;
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z;
          const prelimBounds = {};
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const nodeId of interaction.nodeIds) {
            const node = assertNode(nodeId);
            const origin = interaction.startNodePositions[nodeId];
            const nx = grid.snap ? snapValue(origin.x + deltaX, grid.size) : origin.x + deltaX;
            const ny = grid.snap ? snapValue(origin.y + deltaY, grid.size) : origin.y + deltaY;
            prelimBounds[nodeId] = { x: nx, y: ny, width: node.width, height: node.height };
            minX = Math.min(minX, nx);
            minY = Math.min(minY, ny);
            maxX = Math.max(maxX, nx + node.width);
            maxY = Math.max(maxY, ny + node.height);
          }
          const excludeIds = new Set(interaction.nodeIds);
          const otherEdges = collectOtherNodeEdgesExcluding(state.nodes.values(), excludeIds);
          const groupBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          const snapResult = snapPositionToEdges(groupBounds, otherEdges, 8 / state.camera.z);
          state.snapGuides = snapResult.guides;
          for (const nodeId of interaction.nodeIds) {
            const node = assertNode(nodeId);
            const pb = prelimBounds[nodeId];
            const next = {
              ...node,
              x: pb.x + snapResult.dx,
              y: pb.y + snapResult.dy
            };
            replaceNode(node, next);
            emit("node:moved", cloneNode(next), { x: next.x - interaction.startNodePositions[nodeId].x, y: next.y - interaction.startNodePositions[nodeId].y });
          }
        }, true);
        return;
      }
      if (interaction.mode === "resizing-node") {
        runCommand("updatePointer", [pointerId, screenPoint], () => {
          const node = assertNode(interaction.nodeId);
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z;
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z;
          const constraints = { minWidth: nodeConstraints.minWidth, minHeight: nodeConstraints.minHeight };
          const locked = Boolean(modifiers?.shift);
          const raw = locked ? applyResizeDeltaLocked(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, constraints, interaction.aspectRatio) : applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, constraints);
          if (locked) {
            const nextBounds = grid.snap ? snapResizedBoundsLocked(raw, interaction.startNodeBounds, interaction.handle, grid.size, constraints, interaction.aspectRatio) : raw;
            state.snapGuides = [];
            replaceNode(node, { ...node, ...nextBounds });
          } else {
            const gridSnapped = grid.snap ? snapResizedBounds(raw, interaction.handle, grid.size, constraints) : raw;
            const otherEdges = collectOtherNodeEdges(state.nodes.values(), interaction.nodeId);
            const snapResult = snapBoundsToEdges(gridSnapped, interaction.handle, otherEdges, 8 / state.camera.z);
            state.snapGuides = snapResult.guides;
            replaceNode(node, { ...node, ...snapResult.bounds });
          }
        }, true);
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
        const prevInteraction = state.interaction;
        state.snapGuides = [];
        if (prevInteraction.mode === "dragging-nodes") {
          reparentAfterDrag(prevInteraction.nodeIds);
        }
        setInteraction({ mode: "idle" });
      });
    },
    getUniformTranslationTargets(seedIds) {
      return collectUniformTranslationTargets(seedIds, state.nodes);
    },
    syncGroupZOrder(groupId) {
      runCommand("syncGroupZOrder", [groupId], () => {
        assertNode(groupId);
        restackGroupDescendantsAbove(groupId);
      });
    },
    exportJSON() {
      return JSON.stringify(getSnapshot());
    },
    importJSON(json, mode = "replace") {
      runCommand("importJSON", [mode], () => {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.nodes)) {
          throw new Error("Invalid canvas document: missing nodes array.");
        }
        for (const node of parsed.nodes) {
          if (typeof node.id !== "string" || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
            throw new Error(`Invalid canvas document: node "${node.id ?? "?"}" has invalid geometry.`);
          }
        }
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
  addDescendants,
  applyResizeDelta,
  applyResizeDeltaLocked,
  boundsContain,
  boundsIntersect,
  clamp,
  collectNodeEdges,
  collectSubtreeIds,
  collectUniformTranslationTargets,
  createCanvasEngine,
  expandGroupDragSeeds,
  findContainingGroup,
  getBoundsFromNode,
  getBoundsFromPoints,
  getVisibleBounds,
  groupArea,
  isStrictDescendantOf,
  lerp,
  lerpCamera,
  pointInBounds,
  screenToWorld,
  snapBounds,
  snapBoundsToEdges,
  snapPoint,
  snapPositionToEdges,
  snapResizedBounds,
  snapResizedBoundsLocked,
  snapSize,
  snapValue,
  sortIdsByZIndex,
  worldToScreen,
  zoomCameraAtScreenPoint
};
