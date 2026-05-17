# @lupinum/board-history

Undo and redo plugin for `@lupinum/board-core`.

```bash
pnpm add @lupinum/board-history @lupinum/board-core
```

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'

const engine = createBoardEngine({
  extensions: [historyPlugin({ maxSteps: 200 })],
})

engine.ext.history.undo()
engine.ext.history.redo()
```

The plugin captures reducer actions between command lifecycle events and replays
inverse actions for undo/redo.

- Docs: https://vue-board.vercel.app/api/board-history
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
