import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@canvas/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@canvas/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url))
    }
  }
})
