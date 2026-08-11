# nuxt-board

Nuxt module for [Vue Board](https://vue-board.vercel.app/docs/reference/vue-board) that wires board component/composable auto-imports, helper imports, and styles.

## What It Does

- Auto-imports `BoardRoot`, `BoardNode`, `BoardViewport`, `BoardGrid`, `BoardBoxSelect`, `BoardNodeHandle`, `BoardSelectionToolbar`, `BoardSnapGuides`, and `BoardMinimap`
- Auto-imports the core board composables plus `useBoardMinimap`
- Auto-imports `createBoardEngine`
- Supports an opt-in `prefix` so you can alias the auto-imports without forcing prefixed names by default
- Lets deterministic board shells render in Nuxt SSR without client-only stubs

## Install

```bash
pnpm add nuxt-board @lupinum/board-core @lupinum/vue-board
```

Then register the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-board'],
})
```

## Usage

```vue
<script setup lang="ts">
import { asNodeId } from '@lupinum/board-core'

const engine = createBoardEngine({
  grid: { size: 24, snap: true },
})

engine.createNode({
  id: asNodeId('nuxt-ssr-board'),
  type: 'text',
  x: 64,
  y: 64,
  width: 220,
  height: 96,
  text: 'Node',
})
</script>

<template>
  <BoardRoot :engine="engine" style="width: 100%; height: 480px;" />
</template>
```

## SSR Notes

With deterministic inputs, Nuxt can render the board shell and initial nodes during SSR. Use stable IDs for setup-time content so server HTML and client hydration match. The reference playground lives at [packages/nuxt-board/playground](https://github.com/Mat4m0/canvas/tree/main/packages/nuxt-board/playground).

## Module Options

```ts
export default defineNuxtConfig({
  modules: ['nuxt-board'],
  board: {
    prefix: '',
    autoImportComponents: true,
    autoImportComposables: true,
  },
})
```

When `prefix` is set, the module aliases the full auto-import surface consistently:

- Components: `<MyBoardRoot>`, `<MyBoardNode>`, ...
- Composables: `useMyBoardEngine()`, `useMyBoardCamera()`, ...
- Helpers: `createMyBoardEngine()`

## Local Development

```bash
pnpm --filter nuxt-board build
pnpm --filter nuxt-board dev
pnpm --filter nuxt-board test
pnpm --filter nuxt-board-playground build
```
