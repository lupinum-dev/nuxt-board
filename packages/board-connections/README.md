# @lupinum/board-connections

Connection and edge rendering plugin for Vue Board.

```bash
pnpm add @lupinum/board-connections @lupinum/board-core @lupinum/vue-board
```

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'

const engine = createBoardEngine({ plugins: [connectionPlugin()] })
const first = engine.createNode({ type: 'text', data: { content: 'A' } })
const second = engine.createNode({
  type: 'text',
  x: 280,
  data: { content: 'B' },
})

engine.ext.connections.createEdge({
  from: first.id,
  to: second.id,
  data: {},
})
```

Render edges with `BoardConnectionLayer` inside `BoardRoot`'s viewport slot.

- Docs: https://vue-board.vercel.app/api/board-connections
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
