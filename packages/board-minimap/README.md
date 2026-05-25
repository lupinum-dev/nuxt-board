# @lupinum/board-minimap

Minimap composable and Vue component for Vue Board.

```bash
pnpm add @lupinum/board-minimap @lupinum/board-core @lupinum/vue-board
```

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardMinimap } from '@lupinum/board-minimap'
import { BoardRoot } from '@lupinum/vue-board'

const engine = createBoardEngine()
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh">
    <template #default>
      <BoardMinimap :engine="engine" />
    </template>
  </BoardRoot>
</template>
```

Peer dependencies: `@lupinum/board-core`, `@lupinum/vue-board`, and Vue 3.5 or newer.

- Docs: https://vue-board.vercel.app/api/board-minimap
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
