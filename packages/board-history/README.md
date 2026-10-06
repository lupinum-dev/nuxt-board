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

## Agent setup

`@lupinum/board-history` ships its documentation inside the package for coding
agents such as Claude Code, Codex and Cursor. The pages match the installed
version, so an agent does not follow the website for a different version.

To set it up, give your coding agent this task:

```text
Set up @lupinum/board-history for coding agents as described under "Agent setup" in its README.
```

### Steps for the agent

1. Find `node_modules/@lupinum/board-history/dist/agent/AGENTS.md`. Look in the
   directory of the project that depends on `@lupinum/board-history` first, then
   in its parent directories up to the repository root (workspaces can hoist
   packages). Read it; it lists the documentation pages.
2. Add the section below to the project's agent instructions: `AGENTS.md`, or
   `CLAUDE.md` if the project has only that file. If it has neither, create
   `AGENTS.md`. Write the path relative to the repository root, through
   `node_modules/@lupinum/board-history` (for example
   `apps/web/node_modules/@lupinum/board-history/...` in a workspace). Never write
   a resolved path such as `node_modules/.pnpm/...`: it contains the version and
   breaks after an upgrade. If a section for `@lupinum/board-history` already
   exists, leave it as it is.

   Use the path you found in place of the sample path:

   ```md
   ## @lupinum/board-history

   Before you change code that uses @lupinum/board-history, read
   `node_modules/@lupinum/board-history/dist/agent/AGENTS.md` and the pages it
   lists. They document the installed version. Prefer them over what you
   remember about this package and over the website.
   ```

3. Do not copy the documentation into the project and do not install a skill.
   The section points into the installed package, so it stays correct after
   every upgrade or downgrade.

If the file does not exist, the installed version has no packaged
documentation. Read the package README and its TypeScript types instead.

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for bugs, or ask in the [Lupinum OSS Discord](https://discord.lupinum.com). Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
