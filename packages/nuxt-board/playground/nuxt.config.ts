export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-board'],
  devtools: { enabled: true },
  compatibilityDate: '2026-04-13',
  css: ['~/assets/board-playground.css'],
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
  board: {},
})
