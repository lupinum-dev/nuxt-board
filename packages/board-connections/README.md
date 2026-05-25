# @lupinum/board-connections

Connection and edge rendering plugin for Vue Board.

```bash
pnpm add @lupinum/board-connections @lupinum/board-core @lupinum/vue-board
```

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'

const engine = createBoardEngine({ extensions: [connectionPlugin()] })
const first = engine.createNode({ type: 'text', text: 'First node' })
const second = engine.createNode({
  type: 'text',
  x: 280,
  text: 'Node',
})

engine.ext.connections.createEdge({
  from: first.id,
  to: second.id,
  data: {},
})
```

Render `BoardConnectionLayer` anywhere under `BoardRoot`; it uses the board context and positions its SVG layer against the board root.

- Docs: https://vue-board.vercel.app/api/board-connections
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
