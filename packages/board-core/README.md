<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/apps/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-core</h1>

<p align="center">Own board state and commands without a framework dependency.</p>

## Purpose

Use this package for board state, commands, selection, grouping, camera control, snapping, guards, events, and first-party plugin hooks.

## Installation

```bash
pnpm add @lupinum/board-core
```

## Quick start

```ts
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({ grid: { size: 20, snap: true } })
const node = engine.createNode({ type: 'text', x: 80, y: 80, text: 'Node' })

engine.select(node.id)
```

## Exports and requirements

The package is framework independent. Use `@lupinum/vue-board` or `@lupinum/nuxt-board` when you need rendering.

The `@lupinum/board-core/internal` subpath is only for separately published first-party packages. Applications must use the top-level API and supported plugins.

## Documentation

Read the [board core reference](https://nuxt-board.lupinum.com/docs/reference/board-core).

## Support, security, and license

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy). This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
