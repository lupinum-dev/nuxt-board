# @lupinum/nuxt-board

Nuxt module for [`@lupinum/vue-board`](../vue-board) that auto-imports board components and composables with SSR-safe defaults.

## What It Does

- Auto-imports `BoardRoot`, `BoardNode`, `BoardViewport`, `BoardGrid`, `BoardBoxSelect`, `BoardNodeHandle`, and `BoardSnapGuides`
- Auto-imports the core board composables from `@lupinum/vue-board`
- Auto-imports `createBoardEngine`
- Transpiles `@lupinum/vue-board` and `@lupinum/board-core` for Nuxt so workspace and linked installs behave consistently
- Supports real Nuxt SSR instead of wrapping the board in client-only stubs

## Install

```bash
pnpm add @lupinum/nuxt-board @lupinum/vue-board @lupinum/board-core
```

Then register the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
})
```

## Usage

```vue
<script setup lang="ts">
import { asNodeId } from '@lupinum/board-core'

const engine = createBoardEngine({
  initialNodes: [
    {
      id: asNodeId('welcome'),
      type: 'text',
      x: 64,
      y: 64,
      width: 220,
      height: 96,
      data: { content: 'Nuxt SSR board' },
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
</script>

<template>
  <BoardRoot :engine="engine" style="width: 100%; height: 480px;" />
</template>
```

## SSR Notes

`@lupinum/nuxt-board` server-renders the board shell and any deterministic initial nodes. If you seed the engine during SSR, use stable IDs for initial content so server HTML and client hydration match. The playground in [`packages/nuxt-board/playground`](./playground) shows the intended pattern.

## Module Options

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
  board: {
    prefix: '',
    autoImportComponents: true,
    autoImportComposables: true,
  },
})
```

## Local Development

```bash
pnpm --filter @lupinum/nuxt-board dev
pnpm --filter @lupinum/nuxt-board test
pnpm --filter @lupinum/nuxt-board-playground build
```
