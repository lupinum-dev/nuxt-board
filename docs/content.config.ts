import { defineGinkoDocsConfig } from '@lupinum/ginko-docs/content'

export default defineGinkoDocsConfig({
  site: {
    name: 'Nuxt Board',
    description:
      'A command-driven board engine and Vue renderer for products that need a real document model.',
    whenToUse: 'Use this site to build node-based editors with Nuxt Board.',
  },
  locales: ['en'],
  blog: false,
})
