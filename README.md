<p align="center">
  <img src="apps/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon">
</p>

<h1 align="center">Nuxt Board</h1>

<p align="center">Build node editors and visual planning tools with one headless engine and native Vue components.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/nuxt-board"><img src="https://img.shields.io/npm/v/@lupinum/nuxt-board?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> The first scoped release is in preparation. Public APIs can change before version 1.0.

## Why use Nuxt Board?

Nuxt Board separates board behavior from Vue rendering. The engine owns state, commands, validation, and events. Vue renders the current model and converts pointer input into board actions.

This design gives you predictable state outside the component tree. You can add your own node content without replacing selection, drag, resize, pan, zoom, or keyboard behavior.

## When to use it

Use Nuxt Board for workflow builders, visual planning tools, graph canvases, whiteboard surfaces, and JSON Canvas document views.

Do not use it when you only need a static diagram. It is also not a complete low-code product or drawing application. Your application must provide its own domain rules and backend behavior.

## Requirements

- Node.js 20.19 or newer.
- Vue 3.5 or newer.
- Nuxt 3.19 or newer when you use `@lupinum/nuxt-board`.

## Installation

Install the core engine and Vue renderer:

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
```

Add the Nuxt module when you use Nuxt:

```bash
pnpm add @lupinum/nuxt-board @lupinum/board-core @lupinum/vue-board
```

## Quick start

Create an engine and pass it to `BoardRoot`:

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import '@lupinum/vue-board/style.css'

const engine = createBoardEngine({ grid: { size: 20, snap: true } })

engine.createNode({
  type: 'text',
  x: 80,
  y: 80,
  width: 260,
  height: 140,
  text: 'Drag and resize me.',
})
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh" />
</template>
```

Register the module in Nuxt:

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
})
```

## How it works

`createBoardEngine()` creates the source of truth. Change the board through commands such as `createNode`, `updateNode`, `select`, `zoomToFit`, and `loadDocument`.

`BoardRoot` subscribes to the engine. It renders the viewport, grid, nodes, handles, selection tools, snap guides, and pointer interaction.

Keep the engine out of Vue deep reactivity. Use `shallowRef` if you store it in Vue state. Load new board content through engine commands instead of replacing a mounted engine.

## Main capabilities

- Drag, resize, select, group, pan, zoom, and snap nodes.
- Use command guards, events, validation, and atomic batches.
- Render custom Vue components for domain-specific node content.
- Import and export JSON Canvas documents.
- Add undo, redo, connections, labels, routing, and a minimap.
- Render deterministic initial boards during Nuxt SSR.

## Packages

| Package                      | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `@lupinum/board-core`        | Headless board state, commands, types, geometry, hierarchy, and events. |
| `@lupinum/vue-board`         | Vue components, pointer interaction, styles, and composables.           |
| `@lupinum/nuxt-board`        | Nuxt module and auto-imports.                                           |
| `@lupinum/board-connections` | Edges, anchors, labels, routing, and connection rendering.              |
| `@lupinum/board-history`     | Undo and redo for engine commands.                                      |

## Documentation

Read the [Nuxt Board documentation](https://nuxt-board.lupinum.com). Start with [why Nuxt Board](https://nuxt-board.lupinum.com/docs/evaluate/why-vue-board) and [your first board](https://nuxt-board.lupinum.com/docs/start-building/your-first-board).

## Contributing and development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request. Run the normal handoff gate before you submit a change:

```bash
corepack enable
pnpm install
pnpm verify
```

Maintainers use the protected workflow in [MAINTAINING.md](MAINTAINING.md) for releases.

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for bugs and focused proposals. Join the [Lupinum OSS Discord](https://discord.gg/RPH6SeA36N) for project discussion.

Use the private process in [SECURITY.md](SECURITY.md) to report a vulnerability. Do not report a vulnerability in a public issue.

## License

Nuxt Board is available under the [MIT License](LICENSE). Copyright belongs to [Lupinum OG](https://lupinum.com).
