---
name: vue-board
description: Build, modify, document, or debug apps and examples using Vue Board, Nuxt Board, @lupinum/board-core, @lupinum/vue-board, @lupinum/board-connections, @lupinum/board-history, or @lupinum/vue-board/minimap. Use when working with node canvases, custom board renderers, JSON Canvas import/export, connection layers, history/undo, minimaps, Nuxt auto-imports, board docs, or tests for this library.
---

# Vue Board

Use this skill to keep Vue Board integrations simple, source-aligned, and copy-paste runnable.

## Start Here

1. Identify the reader/user job: first board, custom renderer, connections, persistence, Nuxt integration, or docs/API work.
2. Prefer the smallest package set and direct engine commands. Do not add adapters, shims, duplicate state, or custom schemas unless the app has a real source-of-truth requirement.
3. Verify claims against source when this repo is available. Docs are helpful, but source and tests are canonical.
4. Make examples copy-paste safe: import required packages, register plugins, render layers under `BoardRoot`, and give `BoardRoot` an explicit height.

## Load References As Needed

- Read `references/core-model.md` for engine defaults, node fields, commands, selection, grid, camera, events, and source paths.
- Read `references/vue-nuxt-rendering.md` for Vue/Nuxt setup, `BoardRoot`, composables, custom renderers, editor controls, and SSR.
- Read `references/features-persistence.md` for connections, history, minimap, JSON Canvas import/export, and read-only command guards.
- Read `references/docs-quality.md` when writing docs, examples, API pages, skill files, or migration guidance.

## Non-Negotiable Invariants

- The engine is the board source of truth. Mutate through commands such as `createNode`, `updateNode`, `select`, `translateSelectedNodes`, `zoomToFit`, and `loadDocument`.
- Package ownership matters: core owns nodes, camera, grid, selection, hierarchy, and JSON Canvas import/export; connections owns edges; history owns runtime undo/redo; minimap is derived UI; Nuxt wires styles, transpilation, and auto-imports.
- Supported node types are JSON Canvas types only: `text`, `file`, `link`, and `group`. Custom renderers change presentation, not node schema.
- Node content fields live directly on the node: `text`, `file`, `subpath`, `url`, `label`, `background`, `backgroundStyle`, and `color`. Do not document or invent `data.content`.
- `BoardNode.color`/`NodeInput.color` is a JSON Canvas color: preset `'1'` through `'6'` or a six-digit hex value.
- `createNode()` selects the new node by default. Pass `select: false` for support nodes such as group wrappers.
- `BoardRoot` needs a real size. Use `style="height: 100vh"` or another explicit parent/container height in examples.
- `BoardConnectionLayer` must render under `BoardRoot`. It owns its SVG layer transform and can be a direct/default child.
- Persist with `engine.exportDocument()` and `engine.loadDocument()`. Do not persist Vue refs, DOM state, or `getState()`.
- If richer product state exists, choose one canonical app model and derive board nodes from it. Do not store the same field in app state and node fields unless there is a rebuild story.

## Implementation Workflow

1. Install the minimal packages:
   - Vue: `@lupinum/board-core` and `@lupinum/vue-board`
   - Nuxt: `@lupinum/nuxt-board`, `@lupinum/board-core`, and `@lupinum/vue-board`
   - Add `@lupinum/board-connections`, `@lupinum/board-history`, or `@lupinum/vue-board/minimap` only when needed.
2. Create one `BoardEngine` and keep it out of Vue deep reactivity. Use `shallowRef(engine)` only if it must live in Vue state.
3. Seed deterministic scenes with complete `initialNodes` records and stable `asNodeId(...)` IDs, especially for SSR/tests. Use `createNode()` when partial `NodeInput` is better.
4. Render with `BoardRoot`; add plugin UI layers under it.
5. For custom cards, register a renderer for an existing node type or use a `#node:{type}` slot.
6. Add tests for invariants, not only happy paths. For docs/examples, run docs typecheck/build and browser checks when interaction matters.

## Verification

Use the repo’s existing checks when editing this repository:

```bash
pnpm format:check
pnpm test:docs
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm pack:check
```

Run `pnpm test:e2e` for browser-visible interaction, docs demo, layout, or routing changes.
