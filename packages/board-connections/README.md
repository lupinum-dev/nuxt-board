<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-connections</h1>

<p align="center">Add typed edges, anchors, labels, routing, and connection rendering to a board.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/board-connections"><img src="https://img.shields.io/npm/v/@lupinum/board-connections?label=npm" alt="npm version"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/nuxt-board/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

> [!WARNING]
> This package has not reached a stable release. Review the changelog before each upgrade.

## Purpose

Use this plugin when nodes must connect to each other. The plugin owns connection state and provides a Vue SVG layer for rendering.

<!-- BEGIN:consumer-onboarding -->

## Use a coding agent

A coding agent is a development tool that can inspect and change your project.

Copy this task prompt into your application agent:

```text
Use the installed Nuxt Board packages to implement my requested feature.
Read the application's instructions first. Resolve @lupinum/board-core/agent-docs
and each installed Board package’s agent-docs entry from this application
directory. Read the relevant local pages.
Preserve the existing AGENTS.md. If it has no equivalent guidance, append
one short note to resolve installed package docs before integration work
and after dependency changes. Do not install a consumer skill.
Check the completed feature using this project's normal commands.
```

The installed documentation matches the package version. If an older version
has no documentation export, use its README, types and matching release docs.

<!-- END:consumer-onboarding -->

## Requirements

Install the same version of this package, `@lupinum/board-core`, and `@lupinum/vue-board`. The fixed-version release keeps the plugin ABI aligned.

## Installation

```bash
pnpm add @lupinum/board-connections @lupinum/board-core @lupinum/vue-board
```

## Quick start

```ts
import { connectionsPlugin } from '@lupinum/board-connections'
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
const first = engine.createNode({ type: 'text', text: 'First' })
const second = engine.createNode({ type: 'text', x: 280, text: 'Second' })

engine.plugins.connections.createEdge({
  from: first.id,
  to: second.id,
  data: {},
})
```

Render `BoardConnectionLayer` below `BoardRoot`. It reads the board context and positions its SVG layer against the board root.

## Exports

The package exports the connections plugin and the Vue connection layer.

## Documentation

Read the [connections reference](https://nuxt-board.lupinum.com/docs/reference/connections).

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy).

## License

This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
