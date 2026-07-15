# Vue Board

Vue Board is a Vue 3 and Nuxt toolkit for building node-based editors: workflow builders, visual planning tools, graph-like canvases, whiteboard surfaces, and JSON Canvas-style document views.

It gives you a headless board engine plus Vue rendering. The engine owns the model and commands; Vue renders that model and translates DOM input into board actions. Optional packages add history, connections, minimaps, and Nuxt auto-imports.

## Is This For You?

Use Vue Board when you need:

- draggable, resizable, selectable nodes on a pan/zoom canvas
- a real board model outside the component tree
- command-based mutation with guards, events, validation, and undo/redo support
- custom Vue renderers for your domain-specific node content
- JSON Canvas import/export, with optional edges, labels, anchors, routing, and minimaps
- Nuxt integration without making Nuxt own the board behavior

This is probably not the right starting point if you only need a static diagram renderer, a general-purpose drawing app, or a complete low-code workflow product with backend execution semantics. Vue Board is the canvas/model layer, not your product domain.

## Quick Start

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
```

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import '@lupinum/vue-board/style.css'

const engine = createBoardEngine({
  grid: { size: 20, snap: true },
})

engine.createNode({
  type: 'text',
  x: 80,
  y: 80,
  width: 260,
  height: 140,
  color: '5',
  text: 'Drag, resize, select, and edit me.',
})
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh" />
</template>
```

For Nuxt:

```bash
pnpm add nuxt-board @lupinum/board-core @lupinum/vue-board
```

```ts
export default defineNuxtConfig({
  modules: ['nuxt-board'],
})
```

## How It Works

`createBoardEngine()` creates the source of truth. Application code changes the board through commands such as `createNode`, `updateNode`, `select`, `zoomToFit`, and `loadDocument`. Pointer sessions are owned by `BoardRoot` through a framework-only adapter.

`BoardRoot` subscribes to the engine and renders the viewport, grid, nodes, resize handles, selection toolbar, snap guides, and pointer interaction. Custom renderers replace node content; they do not replace the interaction model.

```vue
<template>
  <BoardRoot :engine="engine">
    <template #node:text="{ node, selected, beginEdit }">
      <TaskCard :node="node" :selected="selected" @rename="beginEdit" />
    </template>
  </BoardRoot>
</template>
```

Keep the engine out of Vue deep reactivity. If you store it in Vue state, use `shallowRef`. Treat the engine instance passed to `BoardRoot` as stable after mount; to replace board contents, load them through engine commands such as `loadDocument`.

## Packages

Install only the pieces you need.

| Package                      | Use it for                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `@lupinum/board-core`        | Headless board state, commands, types, math helpers, hierarchy, and events.  |
| `@lupinum/vue-board`         | Vue board shell, pointer interaction, default UI, styles, and composables.   |
| `nuxt-board`                 | Nuxt module with board component/composable auto-imports.                    |
| `@lupinum/board-connections` | Edges, anchors, labels, routing, connection state, and connection rendering. |
| `@lupinum/board-history`     | Undo and redo for engine commands.                                           |
| `@lupinum/vue-board/minimap` | Minimap composable and renderer.                                             |

## What You Get

- Nodes: JSON Canvas node types (`text`, `file`, `link`, `group`) with geometry, hierarchy, colors, locking, visibility, and custom renderers.
- Interaction: drag, resize, select, box-select, keyboard shortcuts, pan, zoom, snap-to-grid, and edge snapping.
- State model: immutable public snapshots/subscribables backed by a mutable command engine.
- Extensibility: first-party history, connections, and minimap packages without a required all-in-one bundle.
- Performance basics: viewport culling, level of detail rendering, requestAnimationFrame pointer updates, and batched command notifications.
- Persistence: JSON Canvas import/export in core, with connection metadata handled by the connections package when installed.
- SSR/Nuxt: deterministic initial state support and Nuxt auto-imports through `nuxt-board`.

## Development

```bash
pnpm install
pnpm dev:playground
pnpm dev:docs
```

Run the checks before handing off a change:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:docs
pnpm pack:check
pnpm test:e2e
pnpm audit --prod --audit-level high
```

## Docs

- [Why Vue Board](apps/docs/content/1.evaluate/1.why-vue-board.md)
- [Your First Board](apps/docs/content/2.start-building/2.your-first-board.md)
- [How Vue Board Works](apps/docs/content/1.evaluate/2.how-vue-board-works.md)
- [Performance](apps/docs/content/4.build-features/9.performance.md)
- [API Reference](apps/docs/content/6.reference)
- [Contributing](apps/docs/content/7.project/1.contributing.md)

API reference pages are maintained with the docs content in `apps/docs/content/6.reference`.
