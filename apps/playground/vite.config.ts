import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Icons({
      compiler: 'vue3',
      defaultClass: 'shrink-0',
      defaultStyle: 'display:inline-flex',
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^@lupinum\/board-core\/internal$/,
        replacement: fileURLToPath(
          new URL('../../packages/board-core/src/internal.ts', import.meta.url),
        ),
      },
      {
        find: /^@lupinum\/board-core$/,
        replacement: fileURLToPath(
          new URL('../../packages/board-core/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@lupinum\/vue-board$/,
        replacement: fileURLToPath(
          new URL('../../packages/vue-board/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@lupinum\/board-history$/,
        replacement: fileURLToPath(
          new URL('../../packages/board-history/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@lupinum\/board-connections$/,
        replacement: fileURLToPath(
          new URL(
            '../../packages/board-connections/src/index.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@lupinum\/vue-board\/minimap$/,
        replacement: fileURLToPath(
          new URL('../../packages/vue-board/src/minimap.ts', import.meta.url),
        ),
      },
    ],
  },
})
