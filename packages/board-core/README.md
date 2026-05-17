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

- Docs: https://vue-board.vercel.app
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
