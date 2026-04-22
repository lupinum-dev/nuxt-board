import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@lupinum/board-core': fileURLToPath(
        new URL('../../packages/board-core/src/index.ts', import.meta.url),
      ),
      '@lupinum/vue-board': fileURLToPath(
        new URL('../../packages/vue-board/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-history': fileURLToPath(
        new URL('../../packages/board-history/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-selection': fileURLToPath(
        new URL('../../packages/board-selection/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-connections': fileURLToPath(
        new URL(
          '../../packages/board-connections/src/index.ts',
          import.meta.url,
        ),
      ),
      '@lupinum/board-minimap': fileURLToPath(
        new URL('../../packages/board-minimap/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-serializer': fileURLToPath(
        new URL(
          '../../packages/board-serializer/src/index.ts',
          import.meta.url,
        ),
      ),
    },
  },
})
