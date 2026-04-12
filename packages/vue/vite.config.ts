import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@canvas/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
    }
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'CanvasVue',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@canvas/core']
    }
  }
})
