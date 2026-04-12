import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@canvas/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@canvas/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url)),
      '@canvas/history': fileURLToPath(new URL('../../packages/history/src/index.ts', import.meta.url)),
      '@canvas/selection': fileURLToPath(new URL('../../packages/selection/src/index.ts', import.meta.url)),
      '@canvas/connections': fileURLToPath(new URL('../../packages/connections/src/index.ts', import.meta.url)),
      '@canvas/minimap': fileURLToPath(new URL('../../packages/minimap/src/index.ts', import.meta.url)),
      '@canvas/serializer': fileURLToPath(new URL('../../packages/serializer/src/index.ts', import.meta.url))
    }
  }
})
