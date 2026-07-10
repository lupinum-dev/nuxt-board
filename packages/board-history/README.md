# @lupinum/board-history

Undo and redo plugin for `@lupinum/board-core`.

```bash
pnpm add @lupinum/board-history @lupinum/board-core
```

```ts
import { createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'

const engine = createBoardEngine({
  plugins: [historyPlugin({ maxSteps: 200 })],
})

engine.plugins.history.undo()
engine.plugins.history.redo()
```

The plugin captures committed structural roots. A completed drag, resize, text
edit, or outer `batch()` creates one deterministic undo frame.

- Docs: https://vue-board.vercel.app/api/board-history
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
