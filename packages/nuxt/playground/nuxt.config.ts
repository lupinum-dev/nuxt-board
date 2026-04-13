export default defineNuxtConfig({
  modules: ['@canvas/nuxt'],
  devtools: { enabled: true },
  compatibilityDate: '2026-04-13',
  css: ['~/assets/playground.css'],
  build: {
    transpile: [
      '@canvas/core',
      '@canvas/vue',
      '@canvas/connections',
      '@canvas/history',
      '@canvas/minimap',
      '@canvas/serializer',
      '@canvas/nuxt',
    ],
  },
  canvas: {},
})
