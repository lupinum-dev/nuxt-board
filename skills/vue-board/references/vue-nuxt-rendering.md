# Vue and Nuxt Rendering Reference

Use this reference for `@lupinum/vue-board` and `@lupinum/nuxt-board` implementation patterns.

## Contents

- [Source Paths](#source-paths)
- [Vue Setup](#vue-setup)
- [Nuxt Setup](#nuxt-setup)
- [Custom Renderers](#custom-renderers)
- [LOD and Performance](#lod-and-performance)
- [Composables](#composables)

## Source Paths

- Vue exports: `packages/vue-board/src/index.ts`
- Board shell: `packages/vue-board/src/components/BoardRoot.vue`
- Renderer wrapper: `packages/vue-board/src/components/BoardNode.vue`
- Composables: `packages/vue-board/src/useBoardEngine.ts`
- LOD/culling: `packages/vue-board/src/composables/useLodCulling.ts`
- Nuxt module: `packages/nuxt-board/src/module.ts`

## Vue Setup

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
```

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import '@lupinum/vue-board/style.css'

const engine = createBoardEngine()

engine.createNode({
  type: 'text',
  x: 80,
  y: 80,
  width: 260,
  height: 140,
  text: 'Node',
})
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh" />
</template>
```

If the board is blank, first check container height and stylesheet import.

## Nuxt Setup

```bash
pnpm add @lupinum/nuxt-board @lupinum/board-core @lupinum/vue-board
```

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
})
```

The module adds the Vue Board stylesheet, transpiles board packages, and auto-imports components, composables, and `createBoardEngine()` by default.

Nuxt options:

```ts
board: {
  prefix: '',
  autoImportComponents: true,
  autoImportComposables: true,
}
```

With `prefix: 'My'`, aliases include `<MyBoardRoot>`, `useMyCamera()`, and `createMyBoardEngine()`.

Use deterministic `initialNodes` with stable IDs for SSR:

```ts
import { asNodeId } from '@lupinum/board-core'

const engine = createBoardEngine({
  initialNodes: [
    {
      id: asNodeId('welcome'),
      type: 'text',
      x: 100,
      y: 100,
      width: 240,
      height: 160,
      text: 'Node',
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
```

## Custom Renderers

Custom renderers change presentation only. Register them for existing JSON Canvas node types:

```vue
<script setup lang="ts">
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import TextCard from './TextCard.vue'

const renderers: BoardRendererRegistry = {
  text: TextCard,
}
</script>

<template>
  <BoardRoot :engine="engine" :renderers="renderers" style="height: 100vh" />
</template>
```

Renderer props include `node`, `selected`, `editing`, `beginEdit`, and `commitText`.

Do not mutate `node`. Call engine commands or renderer callbacks.

For text inputs, use real form controls or `contenteditable` and add `data-editor="true"` so pointer and double-click handlers pass through editor controls.

Named slot resolution order:

1. `#node:{type}`
2. `#node`
3. `renderers[type]`
4. `fallbackRenderer`
5. built-in text renderer

Use `#node:text`, `#node:file`, `#node:link`, or `#node:group`, not app-specific node types.

## LOD and Performance

`BoardRoot` LOD thresholds:

- `full`: selected nodes or screen size `>= 96px`
- `simple`: screen size `6–96px`
- `hidden`: screen size `< 6px`

Viewport culling uses `cull-margin`, default `200` world units. `useBoardVisibleNodes(300)` uses a world-unit margin.

## Composables

Call `@lupinum/vue-board` composables from components rendered under `BoardRoot`; they inject the `BoardRoot` context and throw outside it. Feature packages may expose separate APIs that accept an engine explicitly, such as `useBoardMinimap(engine)`. Common Vue Board composables:

- `useBoardEngine`
- `useBoardCamera`
- `useBoardNodes`
- `useBoardSelection`
- `useBoardInteraction`
- `useBoardVisibleBounds`
- `useBoardVisibleNodes`
- `useBoardGridStyle`
- `useBoardNode`
- `useBoardBoxSelectBounds`

Prefer granular refs over deprecated full snapshot refs.
