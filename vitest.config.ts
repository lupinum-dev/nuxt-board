import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@canvas/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@canvas/vue': fileURLToPath(new URL('./packages/vue/src/index.ts', import.meta.url))
    }
  },
  test: {
    environmentMatchGlobs: [
      ['packages/vue/test/**/*.test.ts', 'jsdom'],
      ['tests/e2e/**/*.spec.ts', 'node']
    ],
    include: ['packages/**/test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
