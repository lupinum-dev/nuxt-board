<p align="center"><img src="https://raw.githubusercontent.com/lupinum-dev/nuxt-board/main/apps/docs/public/app-icon.svg" width="128" alt="Nuxt Board icon"></p>

<h1 align="center">@lupinum/board-connections</h1>

<p align="center">Add typed edges, anchors, labels, routing, and connection rendering to a board.</p>

## Purpose

Use this plugin when nodes must connect to each other. The plugin owns connection state and provides a Vue SVG layer for rendering.

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

## Exports and requirements

Install the same version of this package, `@lupinum/board-core`, and `@lupinum/vue-board`. The fixed-version release keeps the plugin ABI aligned.

## Documentation

Read the [connections reference](https://nuxt-board.lupinum.com/docs/reference/connections).

## Support, security, and license

Open a [GitHub issue](https://github.com/lupinum-dev/nuxt-board/issues) for support. Report vulnerabilities through the [private security process](https://github.com/lupinum-dev/nuxt-board/security/policy). This package uses the [MIT License](https://github.com/lupinum-dev/nuxt-board/blob/main/LICENSE).
