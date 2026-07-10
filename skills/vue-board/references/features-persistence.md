# Features and Persistence Reference

Use this reference for first-party feature packages, JSON Canvas persistence, and read-only policies.

## Contents

- [Source Paths](#source-paths)
- [Connections](#connections)
- [History](#history)
- [Minimap](#minimap)
- [Persistence](#persistence)
- [Read-only and Command Guards](#read-only-and-command-guards)

## Source Paths

- Connections exports/types: `packages/board-connections/src/index.ts` and `packages/board-connections/src/types.ts`
- Connections engine plugin: `packages/board-connections/src/plugin.ts`
- Connections Vue layer: `packages/board-connections/src/layer.ts`
- History plugin: `packages/board-history/src/index.ts`
- Minimap component/composable: `packages/vue-board/minimap/src/index.ts`
- Core persistence: `packages/board-core/src/engine/persistence.ts`
- Engine import/export hooks: `packages/board-core/src/engine.ts`

Feature snippets assume `@lupinum/board-core` and `@lupinum/vue-board` are already installed. Add those packages too when starting from an empty app.

## Connections

Install only when edges are needed:

```bash
pnpm add @lupinum/board-connections
```

Both plugin and layer are required:

```ts
import {
  BoardConnectionLayer,
  connectionsPlugin,
} from '@lupinum/board-connections'

const engine = createBoardEngine({
  plugins: [connectionsPlugin({ routing: 'bezier' })],
})
```

```vue
<BoardRoot :engine="engine" style="height: 100vh">
  <BoardConnectionLayer />
</BoardRoot>
```

Routing styles: `'bezier'`, `'smooth-step'`, `'step'`, `'straight'`, `'arc'`.

Connection defaults are `routing: 'bezier'`, `endpointMode: 'auto'`, and `defaultArrow: 'end'`.

Create edges after endpoint nodes exist:

```ts
const source = engine.createNode({ type: 'text', text: 'Source' })
const target = engine.createNode({ type: 'text', x: 420, text: 'Target' })

engine.plugins.connections.createEdge({
  from: source.id,
  to: target.id,
  label: 'depends on',
  data: {},
})
```

Endpoint mode:

- `auto`: UI-created edges store no anchors and resolve best sides as nodes move.
- `manual`: UI-created edges store side offsets chosen by the user.

`BoardConnectionLayer` can be rendered as a direct/default child of `BoardRoot`; it teleports and transforms its SVG layer itself. Its `engine` prop is optional, but the layer must still render under `BoardRoot` because it uses board DOM and camera context.

## History

Install when undo/redo is needed:

```bash
pnpm add @lupinum/board-history
```

```ts
import { historyPlugin } from '@lupinum/board-history'

const engine = createBoardEngine({
  plugins: [historyPlugin({ maxSteps: 100 })],
})
```

Use `engine.plugins.history.undo()` and `redo()`. History is updated synchronously after each successful outer command, completed gesture, or batch.

History defaults to `maxSteps: 200`. It stores committed structural roots without action replay or timers. If connections are installed, node deletion undo restores connected edges.

History is runtime state. Do not persist undo/redo stacks in board documents.

## Minimap

Install when overview navigation is needed:

```bash
pnpm add @lupinum/vue-board
```

Render under `BoardRoot`:

```vue
<BoardRoot :engine="engine" style="height: 100vh">
  <BoardMinimap :width="180" :height="110" />
</BoardRoot>
```

Minimap has no engine plugin. `BoardMinimap` derives from `BoardRoot` context unless an `engine` prop is passed; `useMinimap(engine)` is the explicit-engine composable.

## Persistence

Persist only `engine.exportDocument()` output. Import with `engine.importDocument(json, 'replace')` or `'merge'`.

Do not persist:

- Vue refs
- DOM state
- `getState()`
- `getState()`
- active pointer/editing interaction state
- runtime snap guides

`exportDocument()` persists JSON Canvas nodes, camera, grid, selection, z-order, lock state, visibility, hierarchy, and installed feature metadata.

Install the same first-party features before importing documents that use them. Documents with edges require the connections extension. History stacks, minimap viewport UI state, active gestures, and DOM state are not persisted.

`importDocument()` validates documents. Invalid node fields, invalid node colors, missing edge endpoints, unsupported edge sides/ends, duplicate IDs, or edge documents without the connections extension fail instead of producing a partial board.

## Read-only and Command Guards

Use command guards for concrete host policy such as read-only mode:

```ts
const removeGuard = engine.addCommandGuard((name, _args, next) => {
  if (name === 'deleteSelected' || name === 'createNode') {
    return
  }
  next()
})
```

Listen to `command:blocked` when UI should explain ignored actions. Remove guards with the returned unsubscribe.
