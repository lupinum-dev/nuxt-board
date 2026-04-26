# @lupinum/vue-board

Vue 3 components and composables for rendering a `@lupinum/board-core` engine.

```bash
pnpm add @lupinum/board-core @lupinum/vue-board
```

```vue
<script setup lang="ts">
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import '@lupinum/vue-board/style.css'

const engine = createBoardEngine()
engine.createNode({
  type: 'text',
  x: 80,
  y: 80,
  data: { content: 'Hello board' },
})
</script>

<template>
  <BoardRoot :engine="engine" style="height: 100vh" />
</template>
```

Peer dependency: Vue 3.5 or newer.

- Docs: https://vue-board.vercel.app/api/vue-board
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
