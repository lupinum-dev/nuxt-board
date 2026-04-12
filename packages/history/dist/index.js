// src/index.ts
var DEFAULT_EXCLUDE = /* @__PURE__ */ new Set([
  "panBy",
  "panTo",
  "zoomAt",
  "zoomTo",
  "zoomToFit",
  "zoomToNodes",
  "beginPan",
  "beginNodeDrag",
  "beginResize",
  "beginBoxSelect",
  "beginTextEdit",
  "endInteraction"
]);
function historyPlugin(options = {}) {
  const maxSteps = Math.max(1, options.maxSteps ?? 200);
  const debounceMs = Math.max(0, options.debounceMs ?? 300);
  const excluded = /* @__PURE__ */ new Set([...options.exclude ?? [], ...DEFAULT_EXCLUDE]);
  return {
    name: "history",
    install(engine) {
      const target = engine;
      const undoStack = [];
      const redoStack = [];
      let previousSnapshot = canonicalSnapshot(engine.getSnapshot());
      let pendingCommand = null;
      let replaying = false;
      function cloneSnapshot(snapshot) {
        return structuredClone(snapshot);
      }
      function commitEntry(commandName) {
        const label = commandName;
        undoStack.push({
          label,
          snapshot: cloneSnapshot(previousSnapshot),
          timestamp: Date.now()
        });
        if (undoStack.length > maxSteps) {
          undoStack.shift();
        }
        redoStack.splice(0, redoStack.length);
        previousSnapshot = canonicalSnapshot(engine.getSnapshot());
        const entry = undoStack[undoStack.length - 1];
        if (entry) {
          engine.emit("history:push", entry);
        }
      }
      function flushPending() {
        if (!pendingCommand) {
          return;
        }
        if (pendingCommand.timer) {
          clearTimeout(pendingCommand.timer);
        }
        const commandName = pendingCommand.name;
        pendingCommand = null;
        commitEntry(commandName);
      }
      function queuePush(commandName) {
        if (pendingCommand?.name === commandName && debounceMs > 0) {
          if (pendingCommand.timer) {
            clearTimeout(pendingCommand.timer);
          }
          pendingCommand.timer = setTimeout(flushPending, debounceMs);
          return;
        }
        flushPending();
        pendingCommand = {
          name: commandName,
          timer: debounceMs > 0 ? setTimeout(flushPending, debounceMs) : null
        };
        if (debounceMs === 0) {
          flushPending();
        }
      }
      function replaceSnapshot(snapshot) {
        replaying = true;
        try {
          engine.importJSON(JSON.stringify(snapshot), "replace");
          previousSnapshot = canonicalSnapshot(engine.getSnapshot());
        } finally {
          replaying = false;
        }
      }
      target.undo = () => {
        flushPending();
        const entry = undoStack.pop() ?? null;
        if (!entry) {
          return;
        }
        redoStack.push({
          label: entry.label,
          snapshot: cloneSnapshot(engine.getSnapshot()),
          timestamp: Date.now()
        });
        replaceSnapshot(entry.snapshot);
        engine.emit("history:undo", entry);
      };
      target.redo = () => {
        flushPending();
        const entry = redoStack.pop() ?? null;
        if (!entry) {
          return;
        }
        undoStack.push({
          label: entry.label,
          snapshot: cloneSnapshot(engine.getSnapshot()),
          timestamp: Date.now()
        });
        replaceSnapshot(entry.snapshot);
        engine.emit("history:redo", entry);
      };
      target.canUndo = () => {
        flushPending();
        return undoStack.length > 0;
      };
      target.canRedo = () => {
        flushPending();
        return redoStack.length > 0;
      };
      target.clearHistory = () => {
        undoStack.splice(0, undoStack.length);
        redoStack.splice(0, redoStack.length);
        pendingCommand = null;
        previousSnapshot = engine.getSnapshot();
        engine.emit("history:clear");
      };
      target.getHistoryState = () => ({
        undoDepth: undoStack.length,
        redoDepth: redoStack.length,
        current: pendingCommand?.name ?? undoStack[undoStack.length - 1]?.label ?? null
      });
      const unsubscribe = engine.on("command:after", (name) => {
        if (replaying || excluded.has(name)) {
          flushPending();
          previousSnapshot = canonicalSnapshot(engine.getSnapshot());
          return;
        }
        queuePush(name);
      });
      return () => {
        unsubscribe();
        flushPending();
      };
    }
  };
}
function canonicalSnapshot(snapshot) {
  return {
    ...structuredClone(snapshot),
    interaction: { mode: "idle" }
  };
}
export {
  historyPlugin
};
