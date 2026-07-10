# Architecture

This workspace is a headless board engine with thin Vue and Nuxt adapters plus
two optional first-party plugins. The design favors one mutation path and clear
ownership over generic extension infrastructure.

## Package ownership

| Package                      | Owns                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lupinum/board-core`        | Document and session state, commands, transactions, validation, hierarchy, geometry policy, JSON Canvas node persistence, events, and subscribables. |
| `@lupinum/vue-board`         | DOM input translation, reactive adaptation, node rendering, bundled chrome, and the optional `minimap` subpath.                                      |
| `@lupinum/board-connections` | The immutable edge slice, edge commands, persistence, routing, hit testing, and headless geometry. Its `/vue` subpath owns connection UI.            |
| `@lupinum/board-history`     | Runtime undo/redo stacks containing structurally shared history roots.                                                                               |
| `nuxt-board`                 | Explicit auto-import, style, and transpilation registration. It owns no board behavior.                                                              |

The core root entry does not import Vue. The connections root entry is also
headless; importing `@lupinum/board-connections/vue` is an explicit UI choice.

## State ownership

The engine distinguishes committed document state from runtime session state.

Document state contains nodes, camera, grid, selection, z-order, and installed
plugin slices. Session state contains viewport measurements, the active
interaction, snap guides, clipboard data, and transient node geometry used by
drag and resize gestures.

`getState()` returns an immutable runtime view. During a gesture its node map is
the derived projection of committed nodes plus transient geometry overrides.
`exportDocument()` returns persisted JSON Canvas data and never includes those
overrides. `loadDocument(unknown, options)` validates and normalizes the whole
boundary before the candidate document can publish.

## Persistent command transaction

Every outer persistent command stages isolated roots in
`packages/board-core/src/engine/transaction.ts`:

1. command guards evaluate an immutable command description;
2. the engine captures the current structural history root;
3. writable maps, sets, scalar records, and plugin state holders are staged;
4. the command and nested commands update the candidate;
5. core and plugin invariants validate the candidate;
6. queued subscribable values and public events publish;
7. commit listeners receive the before/after structural roots.

Immutable node records and unchanged plugin slices remain shared. On failure,
the engine restores the prior root references and rolls back queued
subscribable values and events. There is no compensating public rollback event,
action inversion, replay interpreter, or replay-order table.

Subscriber callbacks run only after the outer command succeeds. Their `prev`
argument is the value from before the outer command, even when several nested
commands updated the same concept.

## Session gestures

Pointer movement is deliberately outside the persistent transaction hot path.
An active drag or resize stores immutable origins and updates transient node
overrides. Vue and connection geometry render the effective projection. Gesture
completion stages one persistent command, applies the final geometry, clears
the overrides, and publishes one history boundary. Cancellation can discard
the session state without rolling a document backward.

### Trace: node drag

1. `usePointerInteraction.ts` translates a DOM pointer event to screen-space
   input.
2. The engine captures gesture origins and a history root.
3. Animation-frame pointer updates change interaction state, snap guides, and
   node overrides only.
4. `$nodes` exposes effective geometry for Vue and connections rendering.
5. `endInteraction` commits final node geometry once.
6. History receives one `moveNodes` frame; JSON Canvas export sees only the
   committed result.

## Failed batch trace

1. `batch()` stages one candidate root and begins one event/subscription queue.
2. Nested commands join that candidate; they do not validate or publish alone.
3. A nested command throws, for example because an explicit ID is duplicated.
4. Core restores the previous state, grid, and plugin-state references.
5. Queued events and subscribable values are discarded.
6. No history frame or plugin commit observer is notified.

The invariant is observable and tested: a failed batch leaves state, events,
subscriptions, plugin slices, and history unchanged.

## Plugins

Plugins are sealed first-party infrastructure. They are installed only during
engine construction and own one named API plus, when needed, one immutable
slice. Applications should not import `@lupinum/board-core/internal`.

The plugin tuple controls public typing. A bare engine has neither
`plugins.connections` nor connection event types; installing the connections
plugin adds both. Importing the package alone changes no global types.

Connections removes incident edges inside the same staged command as node
deletion. Its persistence hook owns only edge document fields. History owns no
persisted slice: it observes successful commits and stores before/after history
roots. Undo and redo restore those roots atomically while preserving the active
camera.

## Events and errors

Persistent entity events are queued until successful publication. Runtime
interaction events use the session path. Listener exceptions cannot undo an
already committed command; the event bus isolates and reports them.

Boundary and lifecycle failures use the small public error taxonomy:
`BoardInputError`, `BoardNotFoundError`, `BoardConflictError`,
`CommandBlockedError`, and `BoardDestroyedError`. `destroy()` is idempotent but
terminal and clears plugin cleanup, listener, guard, trace, animation, and
subscribable resources.

## Vue boundary

`BoardRoot` maps each engine subscribable to one `shallowRef`; it does not keep
a second snapshot mirror. Vue owns DOM measurement, pointer/keyboard event
translation, culling, and presentation. Core owns snapping, hierarchy,
selection, reparenting, and persistence policy.

Bundled grid, selection toolbar, snap guides, and box selection have direct
boolean opt-outs. Connection directionality policy and hit testing live below
the Vue render shell. `BoardConnectionLayer` always uses its enclosing
`BoardRoot` engine so node and edge state cannot come from different engines.

## Verification

Use the narrowest relevant check while developing, then run the release matrix:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build:packages`
- `pnpm test:docs`
- `pnpm pack:check`
- `pnpm test:e2e` for rendering or interaction changes

Packed-consumer checks must resolve generated declarations rather than source
aliases. Nuxt fixtures cover both default and prefixed auto-import names.
