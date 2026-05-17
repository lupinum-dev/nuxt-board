# Architecture

`nuxt-board` is a layered, headless node-based board library plus framework integrations. The layers below are listed top-down: each can depend on layers below it, never sideways or above.

```
┌──────────────────────────────────────────────────────────────┐
│  L6  Framework integrations  (nuxt-board)                    │
│  L5  Plugins                 (history, connections, …)       │
│  L4  Components              (BoardRoot, BoardNode, …)       │
│  L3  Adapters                (vue-board adapter)             │
│  L2  Engine                  (commands + dispatcher + events)│
│  L1  State                   (reducer, slices, actions)      │
└──────────────────────────────────────────────────────────────┘
```

## Core concepts

### Action

A low-level reducer input. Actions always succeed and carry `before` / `after` payloads where needed so they can be inverted trivially. Defined in [`packages/board-core/src/state/actions.ts`](packages/board-core/src/state/actions.ts).

```
NODE_CREATED | NODE_UPDATED | NODE_DELETED | NODES_MOVED
SELECTION_SET | GRID_UPDATED | NEXT_Z_INDEX_BUMPED
BATCH | PLUGIN
```

Plugin actions tunnel through `{ type: 'PLUGIN', plugin: 'connections', action: <inner> }`. The public action union does not need module augmentation.

### Command

A user-facing API call (e.g. `engine.moveNode(id, dx, dy)`) that produces zero or more actions. Commands can fail, can be blocked by middleware, and emit `command:before` / `command:after` events that the history plugin uses to group dispatched actions into one undoable unit.

### Slice

A named region of state. The core owns slices for `nodes`, `selection`, `grid`, etc. Plugins can register their own slice via `BoardPlugin.slice = { initial, reducer, invert? }`. Plugin reducers see _all_ actions, so e.g. `board-connections` can react to `NODE_DELETED` by dispatching `EDGE_DELETED` for any edges that referenced the deleted node — those `EDGE_DELETED` actions land in the same command group and history captures them as part of the original delete.

### Ephemeral vs persistent state

| Kind       | Stored in                                                              | Goes through reducer?            | In history? | Serialized? |
| ---------- | ---------------------------------------------------------------------- | -------------------------------- | ----------- | ----------- |
| Persistent | `state.nodes`, `state.selection`, `state.grid`, plugin slices          | yes                              | yes         | yes         |
| Ephemeral  | `state.camera`, `state.interaction`, `state.snapGuides`, viewport size | no — direct subscribable updates | no          | no          |

Ephemeral state lives in `Subscribable<T>` instances driven by the reactive layer ([`packages/board-core/src/engine/subscribables.ts`](packages/board-core/src/engine/subscribables.ts)). Pan, zoom and drag-in-progress state never enter the action log.

## Trace: a node drag, end-to-end

To understand how a single user action moves through the layers, read these three files in order (~400 LOC total):

1. [`packages/vue-board/src/composables/usePointerInteraction.ts`](packages/vue-board/src/composables/usePointerInteraction.ts) — pointer events become engine commands. Threshold logic, axis-locking, modifier keys.
2. [`packages/board-core/src/engine.ts`](packages/board-core/src/engine.ts) — `updatePointer` (dragging-nodes branch). Computes new positions, calls `replaceStoredNode`, dispatches `NODES_MOVED`, runs `reparentAfterDrag`.
3. [`packages/board-history/src/index.ts`](packages/board-history/src/index.ts) — captures dispatched `NODES_MOVED` actions between `command:before` / `command:after`, coalesces consecutive moves of the same node, replays inverses on undo.

## Plugin contract

```ts
interface BoardPlugin {
  name: string
  slice?: {
    initial: unknown
    reducer: (state: never, action: Action) => unknown
    invert?: (innerAction: never) => unknown
  }
  install(context, options?): void | (() => void)
}
```

The install context is the engine plus a `getPluginState<S>()` overload that returns the plugin's own slice. Plugins read state via `getPluginState`, mutate state via `engine.dispatch({ type: 'PLUGIN', plugin: name, action: ... })`, and can subscribe to `engine.onAction` to react to other plugins' (and core's) actions.

## Verification

The repository ships three layers of tests:

- **Unit / integration** — `pnpm vitest` per package, exercising reducers, commands, plugin behavior.
- **Public API behavior** — [`packages/board-core/test/contract.test.ts`](packages/board-core/test/contract.test.ts) verifies the public document API and runtime snapshot boundary.
- **End-to-end** — Playwright tests drive product behavior through the playground.
