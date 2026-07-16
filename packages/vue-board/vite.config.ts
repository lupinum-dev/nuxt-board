import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@lupinum/board-core/internal': fileURLToPath(
        new URL('../board-core/src/internal.ts', import.meta.url),
      ),
      '@lupinum/board-core': fileURLToPath(
        new URL('../board-core/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        minimap: fileURLToPath(new URL('./src/minimap.ts', import.meta.url)),
      },
      name: 'VueBoard',
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', '@lupinum/board-core', '@lupinum/board-core/internal'],
    },
  },
})
