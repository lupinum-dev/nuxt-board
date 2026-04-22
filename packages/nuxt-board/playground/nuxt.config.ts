import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
  devtools: { enabled: true },
  css: ['~/assets/playground.css'],
  alias: {
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
    '@lupinum/board-serializer': fileURLToPath(
      new URL('../../board-serializer/src/index.ts', import.meta.url),
    ),
  },
  build: {
    transpile: [
      '@lupinum/board-core',
      '@lupinum/vue-board',
      '@lupinum/board-connections',
      '@lupinum/board-history',
      '@lupinum/board-minimap',
      '@lupinum/board-serializer',
      '@lupinum/nuxt-board',
    ],
  },
  compatibilityDate: '2026-04-13',
  board: {},
})
