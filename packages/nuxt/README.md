# @canvas/nuxt

Nuxt module for [`@canvas/vue`](../vue) that auto-imports the canvas components and composables with SSR-safe defaults.

## What It Does

- Auto-imports `CanvasRoot`, `CanvasNode`, `CanvasViewport`, `CanvasGrid`, `CanvasBoxSelect`, `CanvasNodeHandle`, and `CanvasSnapGuides`
- Auto-imports the core canvas composables from `@canvas/vue`
- Auto-imports `createCanvasEngine`
- Transpiles `@canvas/vue` and `@canvas/core` for Nuxt so workspace and linked installs behave consistently
- Supports real Nuxt SSR instead of wrapping the canvas in client-only stubs

## Install

```bash
pnpm add @canvas/nuxt @canvas/vue @canvas/core
```

Then register the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@canvas/nuxt'],
})
```

## Usage

```vue
<script setup lang="ts">
import { asNodeId } from '@canvas/core'

const engine = createCanvasEngine({
  initialNodes: [
    {
      id: asNodeId('welcome'),
      type: 'text',
      x: 64,
      y: 64,
      width: 220,
      height: 96,
      data: { content: 'Nuxt SSR canvas' },
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
</script>

<template>
  <CanvasRoot :engine="engine" style="width: 100%; height: 480px;" />
</template>
```

## SSR Notes

`@canvas/nuxt` server-renders the canvas shell and any deterministic initial nodes. If you seed the engine during SSR, use stable IDs for initial content so server HTML and client hydration match. The playground in [`packages/nuxt/playground`](./playground) shows the intended pattern.

## Module Options

```ts
export default defineNuxtConfig({
  modules: ['@canvas/nuxt'],
  canvas: {
    prefix: '',
    autoImportComponents: true,
    autoImportComposables: true,
  },
})
```

## Local Development

```bash
pnpm --filter @canvas/nuxt dev
pnpm --filter @canvas/nuxt test
pnpm --filter @canvas/nuxt-playground build
```
