# @lupinum/board-minimap

Minimap composable and Vue component for Vue Board.

```bash
pnpm add @lupinum/board-minimap @lupinum/board-core @lupinum/vue-board
```

```vue
<script setup lang="ts">
import { BoardMinimap } from '@lupinum/board-minimap'
</script>

<template>
  <BoardRoot :engine="engine">
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
