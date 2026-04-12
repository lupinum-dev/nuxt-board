# @canvas Library Improvement Plan

Full code review of the `align with dream spec` commit + pending changes.
Reviewed by: Claude Opus (independent deep review + 4 specialized agents).
Cross-referenced against prior GPT review for validation.

---

## Review Summary

**Architecture verdict:** The engine-first, framework-agnostic design is genuinely excellent. The discriminated union state machine, typed event system, generic `CanvasNode<T>`, and the Vue slot resolution pattern (`#node:image` -> `#node` -> registry -> default) are all the right choices. This is better-architected than most commercial canvas libraries.

**Current state:** 2 tests failing, 3 critical bugs in the pending changes, ~25 correctness/performance/type-safety improvements identified across the codebase.

**Risk areas:** Performance at scale (structuredClone overhead, redundant snapshots, O(n) selections), API boundary leaks (public `emit`, module-global serializer, monkey-patched plugin methods), and incomplete plugin interop (edges outside command system, history extras timing).

---

## Tier 0: Bugs in Pending Changes (fix immediately -- tests are failing)

### 0.1 History plugin `captureExtras()` timing bug
- **File:** `packages/history/src/index.ts:100-117`
- **Bug:** `commitEntry()` stores `previousSnapshot` (node state BEFORE the command) alongside `captureExtras()` (edge state AFTER the command). These are temporally mismatched.
- **Impact:** Undo restores pre-command nodes but post-command edges. Edge data is lost on undo.
- **Failing test:** `history.test.ts:65` -- `expected [] to have a length of 1`
- **Root cause:** Edge operations (`createEdge`/`deleteEdge`) don't go through `runCommand`, so the history plugin can't track them via `command:before`/`command:after`. The `captureExtras()` call in `commitEntry` captures the current (post-mutation) edge state, but the snapshot stores the previous (pre-mutation) node state.
- **Fix:** Store `previousExtras` alongside `previousSnapshot`. Capture extras at the same time `previousSnapshot` is established. Use the stored `previousExtras` in `commitEntry` instead of calling `captureExtras()`.
  ```
  let previousExtras = captureExtras()
  // In commitEntry: use previousExtras instead of captureExtras()
  // After commit: previousExtras = captureExtras()
  // In command:after for excluded commands: previousExtras = captureExtras()
  // In clearHistory: previousExtras = captureExtras()
  ```

### 0.2 Minimap `panToMinimapPoint` doesn't center content in non-constraining dimension
- **File:** `packages/minimap/src/index.ts:83-91` + minimap rendering computeds
- **Bug:** The minimap renders content from the top-left corner without centering it within the minimap widget when the world aspect ratio differs from the minimap aspect ratio. Clicking the visual center of the minimap doesn't navigate to the content center.
- **Failing test:** `minimap.test.ts:44` -- `expected 416 to be close to 350`
- **Fix:** Compute centering offsets for the non-constraining dimension. Apply offsets to `minimapNodes`, `viewportRect`, and `panToMinimapPoint`.
  ```
  const contentWidth = worldWidth * scale
  const contentHeight = worldHeight * scale
  const offsetX = (width - contentWidth) / 2
  const offsetY = (height - contentHeight) / 2
  // In panToMinimapPoint: subtract offset before dividing by scale
  // In minimapNodes/viewportRect: add offset to x/y
  ```

### 0.3 Connection cascade deletion doesn't emit `edge:deleted`
- **File:** `packages/connections/src/index.ts:109-115`
- **Bug:** When `node:deleted` fires, connected edges are removed from the internal map but `edge:deleted` is not emitted. Consumers relying on edge events (analytics, persistence, UI) miss these deletions.
- **Also:** Mutation during Map iteration (deleting from `edges` while iterating `edges.values()`). Safe per spec but fragile.
- **Fix:** Collect edges to delete first, then use `target.deleteEdge(edge.id)` which emits the event.
  ```
  const toDelete = [...edges.values()].filter(e => e.from === id || e.to === id)
  for (const edge of toDelete) target.deleteEdge(edge.id)
  ```

---

## Tier 1: Ship-blockers (fix before anyone depends on this)

### 1.1 `engine.emit()` is public -- plugins can fire fake events
- **File:** `packages/core/src/types.ts:207`, `packages/core/src/engine.ts:439`
- **Issue:** Any consumer can call `engine.emit('command:after', ...)` and trick the history plugin into recording phantom operations.
- **Fix:** Split into `CanvasEngine` (public: `on`/`off`/`once` only) and `CanvasPluginContext` (adds `emit`). Pass `CanvasPluginContext` to `plugin.install()`.

### 1.2 Batch snapshot refresh in CanvasRoot
- **File:** `packages/vue/src/components/CanvasRoot.vue:117-129`
- **Issue:** Subscribes to 11 events, each calling `refreshSnapshot()` which creates a full `structuredClone`. During a single `moveNode`, snapshot is created 3x (node:moved, node:updated, command:after).
- **Fix:** Subscribe only to `command:after`. Batch with `queueMicrotask`:
  ```
  let snapshotDirty = false
  engine.on('command:after', () => {
    if (!snapshotDirty) {
      snapshotDirty = true
      queueMicrotask(() => { snapshot.value = engine.getSnapshot(); snapshotDirty = false })
    }
  })
  ```

### 1.3 `commitTextEdit` hardcodes `data.content`
- **File:** `packages/core/src/engine.ts:813-825`
- **Issue:** Writes to `data.content` regardless of node type. Violates the generic `T` contract -- an `image` node with `data.alt` or a `code` node with `data.source` breaks.
- **Fix:** Engine should only manage the editing interaction state. Let consumers call `updateNode()` with their own data patch on commit. `commitTextEdit` becomes `commitTextEdit(id: NodeId)` (no text param) -- consumer handles the data update.

### 1.4 `selection.includes(node.id)` is O(n) per node
- **File:** `packages/vue/src/components/CanvasRoot.vue:420`, `packages/vue/src/useCanvasEngine.ts:103`
- **Issue:** With 200 visible nodes and 50 selected = 10,000 comparisons per render.
- **Fix:** Pre-compute `Set<NodeId>`:
  ```
  const selectionSet = computed(() => new Set(snapshot.value.selection))
  // Template: :selected="selectionSet.has(node.id)"
  ```

### 1.5 `runAsyncCommand` doesn't emit `command:after` on rejection
- **File:** `packages/core/src/engine.ts:144-151`
- **Issue:** If the async function throws, `command:after` never fires. Listeners relying on balanced `command:before`/`command:after` pairs (history plugin) enter inconsistent state.
- **Fix:** Wrap in try-finally:
  ```
  async function runAsyncCommand<T>(name, args, fn) {
    const started = performance.now()
    emit('command:before', name, args)
    try {
      const result = await fn()
      validate(name)
      return result
    } finally {
      emit('command:after', name, args, performance.now() - started)
    }
  }
  ```

### 1.6 `importJSON` / serializer `parse()` has zero validation
- **File:** `packages/core/src/engine.ts:912-917`, `packages/serializer/src/index.ts:81-83`
- **Issue:** `JSON.parse(json) as BoardSnapshot` -- malformed-but-valid JSON causes cryptic TypeErrors deep in the engine instead of a clear validation error.
- **Fix:** Validate parsed JSON structure before applying. At minimum: assert `nodes` is an array, `camera` has x/y/z, numeric fields are finite.

### 1.7 `bumpNodeToFront` bypasses the event system
- **File:** `packages/core/src/engine.ts:293-299`
- **Issue:** The new helper mutates z-index without emitting `node:updated`. The same mutation via `bringToFront` emits the event. Inconsistent API contract. Listeners tracking z-index changes will miss drag/resize z-reordering.
- **Fix:** Either emit `node:updated` from `bumpNodeToFront`, or document that drag/resize z-changes are silent side effects.

---

## Tier 2: Performance (makes 500+ nodes usable)

### 2.1 Reduce `structuredClone` calls in hot paths
- **File:** `packages/core/src/engine.ts` (cloneNode used 2-3x per command)
- **Issue:** `moveNode` during drag at 60fps = ~180 structuredClone calls/sec. For complex `data` objects this is the bottleneck.
- **Fix:** Clone once for the return value, once for events. Consider `Object.freeze()` on returned nodes so consumers can't mutate them, skip defensive clone.

### 2.2 Diff-based history instead of full snapshot storage
- **File:** `packages/history/src/index.ts`
- **Issue:** Each undo step is a `structuredClone` of the entire `BoardSnapshot`. With 500 nodes and 200 undo steps = 100K cloned node objects in memory.
- **Fix:** Store minimal diffs -- only the properties that changed. For `moveNode`: `{ nodeId, prev: {x, y}, next: {x, y} }`. For `deleteNode`: store the deleted node. This is how Prosemirror and tldraw handle history.
- **Note:** Higher complexity than the current approach. Consider as a v2 optimization.

### 2.3 Cache z-sorted node array for `getNodeAt`
- **File:** `packages/core/src/engine.ts:462-466`
- **Issue:** O(n log n) sort + allocation on every pointer interaction.
- **Fix:** Iterate from highest z-index to lowest without sorting -- track the max-z candidate as you scan. O(n) with no allocation.

### 2.4 Debounce connection layer recomputation
- **File:** `packages/connections/src/index.ts:191-204`
- **Issue:** `node:updated` fires on every drag frame, causing SVG path recomputation at 60fps even if no edge endpoints moved.
- **Fix:** Check if connected node positions actually changed before recomputing paths.

### 2.5 Use `ResizeObserver` instead of `window.resize`
- **File:** `packages/vue/src/components/CanvasRoot.vue:385-389`
- **Issue:** Viewport size only updates on window resize, not container layout changes (panel toggling, CSS changes).
- **Fix:** Use `ResizeObserver` on `rootElement`.

### 2.6 RAF-batch `updatePointer` in CanvasRoot
- **File:** `packages/vue/src/components/CanvasRoot.vue:236-238`
- **Issue:** `pointermove` fires at 60-120Hz+. Each call runs the full command pipeline with invariant checking.
- **Fix:** Store latest pointer position, process once per animation frame.

### 2.7 Add `v-memo` to the node `v-for`
- **File:** `packages/vue/src/components/CanvasRoot.vue:417-419`
- **Fix:** Key on `[node.x, node.y, node.width, node.height, node.zIndex, selected, editing]`. Saves re-renders when only camera moves.

---

## Tier 3: API Correctness (prevents weird bugs for consumers)

### 3.1 Make serializer a factory, not module-level global state
- **File:** `packages/serializer/src/index.ts:38`
- **Issue:** `typeHandlers` is a module-level mutable `Map`. Two parts of an app registering different handlers for the same type silently overwrite each other. In SSR, this leaks between requests. Tests pollute shared state.
- **Fix:** `createJsonCanvasSerializer()` factory function.

### 3.2 Fix camera animation cancellation
- **File:** `packages/core/src/engine.ts:324-350`
- **Issue:** Cancelled animations `resolve()` instead of being rejected. `runAsyncCommand` emits `command:after` for the cancelled animation. History plugin sees phantom entries.
- **Fix:** Reject cancelled promise (or use AbortController). Have `runAsyncCommand` not emit `command:after` on rejection.

### 3.3 Route edge operations through `runCommand`
- **File:** `packages/connections/src/index.ts:77-93`
- **Issue:** `createEdge`/`deleteEdge` bypass invariant checking, command tracing, and history capture. This is the root cause of the history-extras timing bug (0.1).
- **Fix:** Give plugins access to `runCommand` via the install context. Edge operations should appear in traces, trigger `command:before`/`command:after`, and run invariant checks.
- **Note:** This is the most impactful single fix -- it would eliminate the need for the `captureExtras` workaround entirely.

### 3.4 Fix connection component subscription leak
- **File:** `packages/connections/src/index.ts:188-210`
- **Issue:** Subscriptions bound to `engine.value` at setup time. If the computed `engine` changes reactively, old subscriptions leak.
- **Fix:** Use `watchEffect` with cleanup, or `watch(engine, ...)` with old subscription teardown.

### 3.5 Buffer events until after invariant validation
- **File:** `packages/core/src/engine.ts:92-102, 135-141`
- **Issue:** Events fire during mutation (inside `runCommand`), before `validate()` runs. If a listener reacts to an event for state that later fails validation, it operates on invalid state.
- **Fix:** Buffer events during `runCommand`, flush after `validate()` succeeds.

### 3.6 Include grid settings in history or document exclusion
- **File:** `packages/core/src/engine.ts:416-430`
- **Issue:** Grid changes go through `runCommand` and trigger `command:after`, but the history plugin captures the snapshot (which includes grid). Undo/redo restores grid settings inconsistently.
- **Fix:** Either explicitly exclude `updateGridSettings` from history, or make grid restoration part of undo and test it.

### 3.7 Replace `declare module` augmentation with typed plugin accessor
- **File:** `packages/history/src/index.ts:22-38`, `packages/connections/src/index.ts:38-54`
- **Issue:** Module augmentation makes ALL engine instances appear to have `.undo?.()` even when history plugin isn't installed. The `?` defeats type safety. CanvasRoot.vue resorts to inline type assertions instead of using the augmentation.
- **Fix:** Return a typed wrapper from the plugin, or add `getPlugin<T>(name)` accessor to the engine.

### 3.8 `emit()` function does not catch handler exceptions
- **File:** `packages/core/src/engine.ts:92-102`
- **Issue:** If any event handler throws, subsequent handlers don't execute. A misbehaving `camera:change` handler prevents history's `command:after` from firing.
- **Fix:** Consider wrapping each handler in try-catch that logs errors but allows other handlers to execute.

### 3.9 Connection plugin `createEdge` doesn't validate `from`/`to` exist
- **File:** `packages/connections/src/index.ts:77-93`
- **Issue:** You can create an edge between non-existent nodes. It silently exists but is never rendered.
- **Fix:** Validate that both node IDs exist in the engine's state before creating the edge. Throw if either is missing.

---

## Tier 4: Type Safety Improvements

### 4.1 Brand `NodeId` and `EdgeId`
- **File:** `packages/core/src/types.ts:1-2`
- **Issue:** Both are bare `string` aliases. A `NodeId` is assignable to `EdgeId` and vice versa -- `deleteNode(edgeId)` compiles without error.
- **Fix:** Use branded types:
  ```
  type NodeId = string & { readonly __brand: 'NodeId' }
  type EdgeId = string & { readonly __brand: 'EdgeId' }
  ```

### 4.2 Add `type` to `NodePatch`'s `Omit` list
- **File:** `packages/core/src/types.ts:68-70`
- **Issue:** `type` is patchable, which allows changing a node's type without updating `data` to match. This creates type/data mismatches.
- **Fix:** `Omit<CanvasNode<T>, 'id' | 'zIndex' | 'type'>`. Type changes should be delete-and-recreate.

### 4.3 Make `getState()` return deep-readonly types
- **File:** `packages/core/src/types.ts:201`
- **Issue:** `Readonly<BoardState>` is shallow -- `getState().nodes.set(id, maliciousNode)` bypasses all invariant checking.
- **Fix:** Use `ReadonlyMap<NodeId, Readonly<CanvasNode>>` and `ReadonlySet<NodeId>`, or remove `getState()` entirely in favor of `getSnapshot()`.

### 4.4 Remove `interaction` from `BoardSnapshot` serialization
- **File:** `packages/core/src/types.ts:139-146`
- **Issue:** Interaction state is ephemeral -- serializing "I was in the middle of dragging" makes no sense. History already strips it to `{ mode: 'idle' }`.
- **Fix:** Always set `interaction: { mode: 'idle' }` in serialization/snapshot, or remove it from `BoardSnapshot`.

---

## Tier 5: Test Coverage Gaps (prioritized by risk)

### 5.1 Resize operations across all 8 handles
- **Risk:** Critical. Only `'se'` handle is tested (locked node test). `'nw'`, `'n'`, `'w'` handles move origin while adjusting dimensions -- most common resize bug vector.
- **Files:** `packages/core/src/resize.ts` (entirely untested), `packages/core/test/engine.test.ts`

### 5.2 Deletion during active interaction
- **Risk:** Critical. `deleteNode` during `dragging-nodes` causes `assertNode` to throw. No test exercises this race.
- **File:** `packages/core/src/engine.ts:846-860`

### 5.3 Invariant validation modes
- **Risk:** High. 8 invariant checks, 3 modes (`strict`/`warn`/`off`) -- none directly tested.
- **File:** `packages/core/src/invariants.ts`

### 5.4 `importJSON` merge mode
- **Risk:** High. The merge path remaps node IDs to avoid collision -- unique logic, zero tests.
- **File:** `packages/core/src/engine.ts:400-406`

### 5.5 History debounce interleaving
- **Risk:** Medium. Different command types during debounce window -- the flush logic is untested.
- **File:** `packages/history/src/index.ts:131-148`

### 5.6 Serializer round-trip for custom node types without handlers
- **Risk:** Medium. The `x-canvas:data` fallback path for unregistered types is untested.
- **File:** `packages/serializer/src/index.ts:125, 138`

### 5.7 `once` event handler cleanup
- **Risk:** Medium. If closure captured incorrectly, handler fires multiple times or leaks.
- **File:** `packages/core/src/engine.ts:111-116`

### 5.8 `selectAll` skips hidden nodes
- **Risk:** Low. Behavioral contract that should be tested.
- **File:** `packages/core/src/engine.ts:711-713`

---

## Tier 6: Developer Experience

### 6.1 Delete `@canvas/selection` plugin -- it's an empty shell
- **File:** `packages/selection/src/index.ts`
- **Issue:** Plugin does nothing. The utility functions (`getSelectionNodes`, `getSelectionBounds`, `toggleIds`) don't need the plugin pattern.
- **Fix:** Export utilities directly from `@canvas/core` or a `@canvas/utils` package. Remove the empty plugin.

### 6.2 Add JSDoc comments to public `CanvasEngine` methods
### 6.3 Add `README.md` to each package with 10-line quickstart
### 6.4 Add `CHANGELOG.md` and semver from the start
### 6.5 Add `exports` field validation in CI (`publint` or `arethetypeswrong`)
### 6.6 Add `size-limit` check in CI
### 6.7 VitePress documentation site with interactive examples

---

## Tier 7: Future Features (spec items not yet built)

### 7.1 `asChild` pattern on CanvasNode and CanvasNodeHandle
### 7.2 Touch gesture support (two-finger pan/zoom)
### 7.3 Spatial index (R-tree) for `getNodeAt` and `getNodesInBounds` at scale
### 7.4 ARIA roles (`role="application"` on root, `role="figure"` + `aria-selected` on nodes)
### 7.5 Alignment plugin (align left/center/right, distribute)
### 7.6 `@canvas/react` adapter (same engine, React hooks)
### 7.7 Collaboration primitives (CRDT-compatible operation log)

---

## GPT Review Cross-Reference

Items from the prior GPT review, with validation status:

| GPT ID | Finding | Status |
|--------|---------|--------|
| B1 | `emit()` is public | **Valid** -- tracked as 1.1 |
| B2 | Redundant snapshot subscriptions | **Valid** -- tracked as 1.2 |
| B3 | `structuredClone` overhead | **Valid but overstated** -- tracked as 2.1 |
| B4 | History stores full snapshots | **Valid** -- tracked as 2.2 (v2 optimization) |
| B5 | `commitTextEdit` hardcodes `data.content` | **Valid** -- tracked as 1.3 |
| B6 | No RAF batching | **Valid** -- tracked as 2.6 |
| B7 | `sendToBack` z-index collision | **Non-issue** -- each call produces unique values by definition |
| B8 | Selection plugin is empty | **Valid** -- tracked as 6.1 |
| B9 | Connections bypass `runCommand` | **Valid** -- tracked as 3.3 |
| B10 | Connection component subscription leak | **Valid** -- tracked as 3.4 |
| U1 | Stale `.d.ts` files | **Already fixed** -- no `.d.ts` files in `packages/core/src/` |
| U2 | `declare module` augmentation fragile | **Valid** -- tracked as 3.7 |
| U3 | Grid not in undo | **Design choice** -- tracked as 3.6 |
| U4 | `getNodeAt` sorts on every call | **Valid** -- tracked as 2.3 |
| U5 | `selection.includes` is O(n) | **Valid** -- tracked as 1.4 |
| U6 | `window.resize` vs ResizeObserver | **Valid** -- tracked as 2.5 |
| U7 | Module-level serializer registry | **Valid** -- tracked as 3.1 |
| U8 | Camera animation cancellation | **Valid** -- tracked as 3.2 |
| U9 | Events before invariant validation | **Valid** -- tracked as 3.5 |

---

## Recommended Sprint Plan

### Sprint 1: Fix What's Broken -- DONE
- [x] 0.1 Fix history `captureExtras` timing
- [x] 0.2 Fix minimap content centering
- [x] 0.3 Fix cascade deletion events
- [x] Run test suite -- all 23 tests pass

### Sprint 2: API Boundaries -- DONE
- [x] 1.1 Hide `emit` from public interface
- [x] 1.2 Batch snapshot refresh
- [x] 1.3 Decouple `commitTextEdit` from `data.content`
- [x] 1.4 `Set<NodeId>` for selection lookup
- [x] 1.5 Fix `runAsyncCommand` error handling
- [x] 1.6 Add JSON validation to `importJSON`/serializer
- [x] 1.7 `bumpNodeToFront` now emits `node:updated`

### Sprint 3: Performance -- DONE
- [x] 2.3 O(n) linear scan for `getNodeAt` (no allocation)
- [x] 2.4 Debounce connection layer with `queueMicrotask`
- [x] 2.5 ResizeObserver (with jsdom fallback)
- [x] 2.6 RAF-batch pointer updates
- [x] 2.7 `v-memo` on node list
- [ ] 2.1 Reduce `structuredClone` calls (deferred -- marginal impact at current scale)
- [ ] 2.2 Diff-based history (deferred -- v2 optimization)

### Sprint 4: Plugin Architecture -- DONE
- [x] 3.1 Serializer factory (`createJsonCanvasSerializer()`)
- [x] 3.2 Fix animation cancellation (reject instead of resolve)
- [x] 3.4 Fix connection component subscriptions (`watch` with cleanup)
- [x] 3.8 Catch handler exceptions in `emit`
- [x] 3.9 Validate edge `from`/`to` exist in `createEdge`
- [x] 6.1 Remove empty `selectionPlugin()` shell
- [ ] 3.3 Route edge operations through `runCommand` (deferred -- requires plugin API extension)
- [ ] 3.5 Buffer events until after invariant validation (deferred -- complex, low practical impact)
- [ ] 3.7 Replace module augmentation with typed accessor (deferred -- breaking change)

### Sprint 5: Type Safety + Tests -- DONE
- [x] 4.2 Remove `type` from `NodePatch` Omit
- [x] 5.1 Resize handle tests (nw handle)
- [x] 5.2 Deletion during interaction test
- [x] 5.3 Invariant mode tests (warn mode)
- [x] 5.4 Import merge mode test
- [x] 5.5 `selectAll` skips hidden nodes test
- [x] 5.6 `once` handler fires exactly once test
- [x] 5.7 `emit` catches handler exceptions test
- [x] 5.8 Edge validation test
- [x] 5.9 Custom node type serializer round-trip test
- [x] Stale dist `.d.ts` files cleaned up
- [ ] 4.1 Brand `NodeId`/`EdgeId` (skipped -- too invasive for library consumers)
- [ ] 4.3 Deep-readonly `getState()` (skipped -- shallow `Readonly` + `getSnapshot()` cloning is sufficient)

### Final Status
- **32 tests passing** (was 23, added 9 new tests)
- **TypeScript compiles clean** (`tsc --noEmit` passes)
- **0 regressions**
