# @lupinum/board-connections

Connection and edge rendering plugin for Vue Board.

```bash
pnpm add @lupinum/board-connections @lupinum/board-core @lupinum/vue-board
```

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'
import { BoardConnectionLayer } from '@lupinum/board-connections/vue'

const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
const first = engine.createNode({ type: 'text', text: 'First node' })
const second = engine.createNode({
  type: 'text',
  x: 280,
  text: 'Node',
})

engine.plugins.connections.createEdge({
  from: first.id,
  to: second.id,
  data: {},
})
```

Render `BoardConnectionLayer` anywhere under `BoardRoot`; it uses the board context and positions its SVG layer against the board root.

- Docs: https://vue-board.vercel.app/docs/reference/connections
- Issues: https://github.com/Mat4m0/canvas/issues
- License: MIT
