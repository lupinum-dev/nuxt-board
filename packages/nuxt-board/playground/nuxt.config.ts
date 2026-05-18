import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['nuxt-board'],
  devtools: { enabled: true },
  css: ['~/assets/playground.css'],
  alias: {
    '@lupinum/vue-board/style.css': fileURLToPath(
      new URL('../../vue-board/dist/index.css', import.meta.url),
    ),
    '@lupinum/board-core/internal': fileURLToPath(
      new URL('../../board-core/src/internal.ts', import.meta.url),
    ),
    '@lupinum/board-core': fileURLToPath(
      new URL('../../board-core/src/index.ts', import.meta.url),
    ),
    '@lupinum/vue-board': fileURLToPath(
      new URL('../../vue-board/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-history': fileURLToPath(
      new URL('../../board-history/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-connections': fileURLToPath(
      new URL('../../board-connections/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-minimap': fileURLToPath(
      new URL('../../board-minimap/src/index.ts', import.meta.url),
    ),
  },
  build: {
    transpile: [
      '@lupinum/board-core',
      '@lupinum/board-core/internal',
      '@lupinum/vue-board',
      '@lupinum/board-connections',
      '@lupinum/board-history',
      '@lupinum/board-minimap',
      'nuxt-board',
    ],
  },
  compatibilityDate: '2026-04-13',
  vite: {
    resolve: {
      alias: [
        {
          find: /^@lupinum\/board-core\/internal$/,
          replacement: fileURLToPath(
            new URL('../../board-core/src/internal.ts', import.meta.url),
          ),
        },
        {
          find: /^@lupinum\/board-core$/,
          replacement: fileURLToPath(
            new URL('../../board-core/src/index.ts', import.meta.url),
          ),
        },
      ],
    },
  },
  board: {},
})
