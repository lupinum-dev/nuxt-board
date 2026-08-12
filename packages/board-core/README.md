# @lupinum/board-core

Headless engine for node-based boards: state, commands, selection, grouping,
camera, snapping, command guards, events, and first-party feature hooks.

```bash
pnpm add @lupinum/board-core
```

```ts
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({ grid: { size: 20, snap: true } })
const node = engine.createNode({
  type: 'text',
  x: 80,
  y: 80,
  text: 'Node',
})

engine.select(node.id)
```

Use this package directly for framework-agnostic state and with
`@lupinum/vue-board` or `nuxt-board` for rendering.

The exported `@lupinum/board-core/internal` subpath is an unsupported ABI for
separately published first-party packages. It is not capability-private, but
applications should use the top-level API and supported `plugins` instead.
The first-party packages release in lockstep so this internal boundary always
resolves to the matching implementation version.

- Docs: https://nuxt-board.lupinum.com/docs/reference/board-core
- Issues: https://github.com/lupinum-dev/nuxt-board/issues
- License: MIT
