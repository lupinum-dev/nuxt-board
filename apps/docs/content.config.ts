import { defineGinkoDocsConfig } from '@lupinum/ginko-docs/content'

export default defineGinkoDocsConfig({
  site: {
    name: 'Vue Board',
    description:
      'A command-driven board engine and Vue renderer for products that need a real document model.',
    url: 'https://nuxt-board.lupinum.com',
  },
  locales: ['en'],
  blog: false,
})
