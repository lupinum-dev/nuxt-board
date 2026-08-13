<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/vue-board</h1>

<p align="center">Render a board engine with native Vue components and composables.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/vue-board"><img src="https://img.shields.io/npm/v/@lupinum/vue-board?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> This package has not reached a stable release. Review the changelog before each upgrade.

## Purpose

Use this package to render `@lupinum/board-core` state and handle pointer, keyboard, selection, camera, and node interactions in Vue.

## Requirements

This package requires Vue 3.5 or newer. Install the matching `@lupinum/board-core` version.

## Installation

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
```

## Quick start

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import '@lupinum/vue-board/style.css'

const engine = createBoardEngine()
engine.createNode({ type: 'text', x: 80, y: 80, text: 'Node' })
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh" />
</template>
```

## Exports

The package exports the board components and composables. Keep the engine instance stable after mount. Use an engine command such as `loadDocument` to replace board content.

## Documentation

Read the [Vue package reference](https://nuxt-board.lupinum.com/docs/reference/vue-board).

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
