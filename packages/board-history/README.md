<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-history</h1>

<p align="center">Add deterministic undo and redo to the Nuxt Board engine.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/board-history"><img src="https://img.shields.io/npm/v/@lupinum/board-history?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> This package has not reached a stable release. Review the changelog before each upgrade.

## Purpose

Use this plugin when users must reverse committed board changes. One completed drag, resize, text edit, or outer batch creates one history frame.

## Requirements

Install the same version of this package and `@lupinum/board-core`. The fixed-version release keeps the plugin ABI aligned with the engine.

## Installation

```bash
pnpm add @lupinum/board-history @lupinum/board-core
```

## Quick start

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'

const engine = createBoardEngine({
  plugins: [historyPlugin({ maxSteps: 200 })],
})

engine.plugins.history.undo()
engine.plugins.history.redo()
```

## Exports

The package exports the history plugin and its typed history controls.

## Documentation

Read the [history reference](https://nuxt-board.lupinum.com/docs/reference/history).

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
