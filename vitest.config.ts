import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@lupinum/board-core': fileURLToPath(
        new URL('./packages/board-core/src/index.ts', import.meta.url),
      ),
      '@lupinum/vue-board': fileURLToPath(
        new URL('./packages/vue-board/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-history': fileURLToPath(
        new URL('./packages/board-history/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-connections': fileURLToPath(
        new URL('./packages/board-connections/src/index.ts', import.meta.url),
      ),
      '@lupinum/board-minimap': fileURLToPath(
        new URL('./packages/board-minimap/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
