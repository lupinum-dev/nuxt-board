# @lupinum/board-selection

Snapshot-based selection helpers for `@lupinum/board-core`.

```bash
pnpm add @lupinum/board-selection @lupinum/board-core
```

```ts
import { getSelectionBounds, getSelectionNodes } from '@lupinum/board-selection'

const selectedNodes = getSelectionNodes(engine)
const bounds = getSelectionBounds(engine)
```

Exports:

- `getSelectionNodes(engine)`
- `getSelectionBounds(engine)`
- `toggleIds(current, ids)`

Peer dependency: `@lupinum/board-core`.

- Docs: https://vue-board.vercel.app/api/board-selection
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
