<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/nuxt-board</h1>

<p align="center">Add the Nuxt Board components, composables, helpers, and styles to Nuxt.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/nuxt-board"><img src="https://img.shields.io/npm/v/@lupinum/nuxt-board?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> This package has not reached a stable release. Review the changelog before each upgrade.

## Purpose

Use this module when a Nuxt application needs board auto-imports and deterministic server rendering.

## Requirements

The module requires Nuxt 3.19 or newer. Install matching versions of the three packages so their public contracts stay aligned.

## Installation

```bash
pnpm add @lupinum/nuxt-board @lupinum/board-core @lupinum/vue-board
```

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
})
```

## Quick start

```vue
<script setup lang="ts">
const engine = createBoardEngine({ grid: { size: 24, snap: true } })
engine.createNode({ type: 'text', x: 64, y: 64, text: 'Nuxt Board' })
</script>

<template>
  <BoardRoot :engine="engine" style="height: 480px" />
</template>
```

## Exports

The module auto-imports the board components, composables, `createBoardEngine`, and the default styles. Use stable node IDs for setup-time content so server HTML matches client hydration.

## Documentation

Read the [Nuxt module reference](https://nuxt-board.lupinum.com/docs/reference/nuxt-board).

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
