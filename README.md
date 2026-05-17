# Vue Board

Vue Board is a Vue 3 and Nuxt toolkit for building node-based editors, canvas tools, workflow builders, and spatial planning surfaces.

The engine is headless. It owns board state, commands, selection, grouping, camera state, middleware, and events. Vue renders that state through components and composables. Optional packages add history, connections, minimaps, and JSON Canvas import/export when your product needs them.

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
  data: { content: 'Plan launch tasks' },
})
</script>

<template>
  <BoardRoot :engine="engine" class="h-screen" />
</template>
```

## Packages

| Package                      | Use it for                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `@lupinum/board-core`        | Headless board engine, types, math helpers, commands, events, and hierarchy. |
| `@lupinum/vue-board`         | Vue components, selection toolbar, default rendering, and composables.       |
| `nuxt-board`                 | Nuxt module with board component and composable auto-imports.                |
| `@lupinum/board-connections` | Edges, anchors, labels, routing, and connection rendering.                   |
| `@lupinum/board-history`     | Undo and redo integration for engine commands.                               |
| `@lupinum/board-minimap`     | Minimap composable and renderer.                                             |
| `@lupinum/board-selection`   | Snapshot-based selection helpers.                                            |

## Install

For Vue:

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
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

## Development

```bash
pnpm install
pnpm dev:playground
pnpm dev:docs
```

Run the checks before handing off a change:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:e2e
```

## Docs

- [Quick Start](packages/docs/content/1.getting-started/3.quick-start.md)
- [Core Concepts](packages/docs/content/2.essentials/1.core-concepts.md)
- [Guides](packages/docs/content/3.guides)
- [API Reference](packages/docs/content/6.api)
- [Contributing](packages/docs/content/8.oss/1.contributing.md)

Run `pnpm docs:api` after changing exported package APIs. The generated API pages live in `packages/docs/content/6.api`.
