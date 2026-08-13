<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/apps/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-history</h1>

<p align="center">Add deterministic undo and redo to the Nuxt Board engine.</p>

## Purpose

Use this plugin when users must reverse committed board changes. One completed drag, resize, text edit, or outer batch creates one history frame.

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

## Exports and requirements

Install the same version of this package and `@lupinum/board-core`. The fixed-version release keeps the plugin ABI aligned with the engine.

## Documentation

Read the [history reference](https://nuxt-board.lupinum.com/docs/reference/history).

## Support, security, and license

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy). This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
