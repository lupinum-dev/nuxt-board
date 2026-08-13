<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-core</h1>

<p align="center">Own board state and commands without a framework dependency.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/board-core"><img src="https://img.shields.io/npm/v/@lupinum/board-core?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> This package has not reached a stable release. Review the changelog before each upgrade.

## Purpose

Use this package for board state, commands, selection, grouping, camera control, snapping, guards, events, and first-party plugin hooks.

## Requirements

The package is framework independent. Use `@lupinum/vue-board` or `@lupinum/nuxt-board` when you need rendering.

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

## Exports

The `@lupinum/board-core/internal` subpath is only for separately published first-party packages. Applications must use the top-level API and supported plugins.

## Documentation

Read the [board core reference](https://nuxt-board.lupinum.com/docs/reference/board-core).

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
