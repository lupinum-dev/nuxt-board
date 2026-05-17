# Architecture

`nuxt-board` is a board library with a headless core, Vue rendering, a Nuxt
auto-import module, and a few first-party extensions. The important boundary is
where behavior actually lives, not how many layers the repository can name.

## Where behavior lives

| Area                         | Owns                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lupinum/board-core`        | Board state, commands, camera, selection, grouping, snapping, node persistence, validation, recorded action replay, and first-party feature hooks. |
| `@lupinum/vue-board`         | Vue components and composables that render a `BoardEngine` and translate DOM input into engine commands.                                           |
| `@lupinum/board-connections` | First-party edge state, JSON Canvas edge persistence, connection geometry, and Vue connection rendering.                                           |
| `@lupinum/board-history`     | Undo/redo for engine actions captured around command events.                                                                                       |
| `@lupinum/board-minimap`     | Derived minimap projection and renderer.                                                                                                           |
| `nuxt-board`                 | Nuxt registration for core helpers and Vue components/composables. It does not own board behavior.                                                 |
| `packages/docs`              | Hand-maintained docs and examples. API pages are content files, not a complete generated source of truth.                                          |

## Core state model

The engine keeps one mutable internal board state and exposes immutable public
views through `getState()`, `getSnapshot()`, and subscribables.

- Persistent state: nodes, selection, grid settings, `nextZIndex`, and
  first-party extension state.
- Runtime state: camera, viewport size, interaction mode, and snap guides.
- Persisted document format: JSON Canvas node fields plus `x-nuxt-board`
  metadata for engine state that JSON Canvas does not define. Edges are owned
  by `@lupinum/board-connections`; core rejects edge documents when that
  extension is not installed.

Commands mutate internal state directly, dispatch actions for observers/history,
emit events, and then validate invariants. Failed validation rolls the engine
back to a restore point. This is not a pure reducer architecture; action replay
exists to support history and extension reactions.

## Extension contract

Connections and history use the current extension hooks:

- `engine.extend()` exposes a first-party API under `engine.ext`.
- Optional slices let an extension reduce dispatched actions into its own state.
- Optional persistence hooks let an extension contribute to import/export.
- `engine.onAction()` lets an extension react to core actions, such as deleting
  edges when a node is deleted.

This contract is intentionally treated as first-party infrastructure, not a
general third-party extension surface.

## Trace: a node drag

Read these files in order:

1. `packages/vue-board/src/composables/usePointerInteraction.ts` translates DOM
   pointer events into engine commands.
2. `packages/board-core/src/engine.ts` handles the active interaction, updates
   node positions, dispatches `NODES_MOVED`, applies snapping, and reparents
   nodes when needed.
3. `packages/board-history/src/index.ts` records dispatched actions between
   `command:before` and `command:after`, then replays inverse actions for undo.

## Verification

Use the narrowest check that proves the changed behavior:

- `pnpm test:unit` for core commands, extension behavior, and Nuxt fixture tests.
- `pnpm typecheck` for workspace, docs, and Nuxt type contracts.
- `pnpm lint` and `pnpm format:check` for style.
- `pnpm pack:check` for package entrypoints and consumer imports.
- `pnpm test:e2e` when rendering, pointer interaction, playground behavior, or
  connection visuals change.
