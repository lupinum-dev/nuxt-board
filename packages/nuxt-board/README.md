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

## Agent setup

`@lupinum/nuxt-board` ships its documentation inside the package for coding
agents such as Claude Code, Codex and Cursor. The pages match the installed
version, so an agent does not follow the website for a different version.

To set it up, give your coding agent this task:

```text
Set up @lupinum/nuxt-board for coding agents as described under "Agent setup" in its README.
```

### Steps for the agent

1. Find `node_modules/@lupinum/nuxt-board/dist/agent/AGENTS.md`. Look in the
   directory of the project that depends on `@lupinum/nuxt-board` first, then
   in its parent directories up to the repository root (workspaces can hoist
   packages). Read it; it lists the documentation pages.
2. Add the section below to the project's agent instructions: `AGENTS.md`, or
   `CLAUDE.md` if the project has only that file. If it has neither, create
   `AGENTS.md`. Write the path relative to the repository root, through
   `node_modules/@lupinum/nuxt-board` (for example
   `apps/web/node_modules/@lupinum/nuxt-board/...` in a workspace). Never write
   a resolved path such as `node_modules/.pnpm/...`: it contains the version and
   breaks after an upgrade. If a section for `@lupinum/nuxt-board` already
   exists, leave it as it is.

   Use the path you found in place of the sample path:

   ```md
   ## @lupinum/nuxt-board

   Before you change code that uses @lupinum/nuxt-board, read
   `node_modules/@lupinum/nuxt-board/dist/agent/AGENTS.md` and the pages it
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
