# nuxt-board

Nuxt module for [Vue Board](https://vue-board.vercel.app/api/vue-board) that auto-imports board components and composables with SSR-safe defaults.

## What It Does

- Auto-imports `BoardRoot`, `BoardNode`, `BoardViewport`, `BoardGrid`, `BoardBoxSelect`, `BoardNodeHandle`, and `BoardSnapGuides`
- Auto-imports the core board composables from `@lupinum/vue-board`
- Auto-imports `createBoardEngine`
- Supports an opt-in `prefix` so you can alias the auto-imports without forcing prefixed names by default
- Transpiles `@lupinum/vue-board` and `@lupinum/board-core` for Nuxt so workspace and linked installs behave consistently
- Supports real Nuxt SSR instead of wrapping the board in client-only stubs

## Install

```bash
pnpm add nuxt-board
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
const engine = createBoardEngine({
  grid: { size: 24, snap: true },
})

engine.createNode({
  type: 'text',
  x: 64,
  y: 64,
  width: 220,
  height: 96,
  data: { content: 'Nuxt SSR board' },
})
</script>

<template>
  <BoardRoot :engine="engine" style="width: 100%; height: 480px;" />
</template>
```

## SSR Notes

`nuxt-board` server-renders the board shell and any deterministic initial nodes. If you seed the engine during SSR, use stable IDs for initial content so server HTML and client hydration match. The reference playground lives at [packages/nuxt-board/playground](https://github.com/Mat4m0/canvas/tree/main/packages/nuxt-board/playground).

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
- Composables: `useMyBoardEngine()`, `useMyCamera()`, ...
- Helpers: `createMyBoardEngine()`

## Local Development

```bash
pnpm --filter nuxt-board build
pnpm --filter nuxt-board dev
pnpm --filter nuxt-board test
pnpm --filter nuxt-board-playground build
```
