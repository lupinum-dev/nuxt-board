import { fileURLToPath } from 'node:url'

const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://vue-board.vercel.app'

export default defineNuxtConfig({
  modules: [
    fileURLToPath(new URL('../nuxt-board/src/module.ts', import.meta.url)),
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms',
    '@nuxtjs/mcp-toolkit'
  ],

  components: [
    {
      path: '~/components/demos',
      pathPrefix: false
    },
    '~/components'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: siteUrl,
    name: 'Vue Board'
  },

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 3
        }
      }
    }
  },

  runtimeConfig: {
    public: {
      siteUrl,
      githubUrl: 'https://github.com/Mat4m0/canvas'
    }
  },

  alias: {
    '@lupinum/board-core': fileURLToPath(new URL('../board-core/src/index.ts', import.meta.url)),
    '@lupinum/vue-board': fileURLToPath(new URL('../vue-board/src/index.ts', import.meta.url)),
    '@lupinum/board-history': fileURLToPath(new URL('../board-history/src/index.ts', import.meta.url)),
    '@lupinum/board-selection': fileURLToPath(new URL('../board-selection/src/index.ts', import.meta.url)),
    '@lupinum/board-connections': fileURLToPath(new URL('../board-connections/src/index.ts', import.meta.url)),
    '@lupinum/board-minimap': fileURLToPath(new URL('../board-minimap/src/index.ts', import.meta.url)),
    '@lupinum/board-serializer': fileURLToPath(new URL('../board-serializer/src/index.ts', import.meta.url))
  },

  experimental: {
    asyncContext: true
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/',
        '/getting-started/introduction',
        '/examples/basic-board'
      ],
      ignore: [/^\/_og\//],
      crawlLinks: true,
      autoSubfolderIndex: false
    }
  },

  board: {
    autoImportComponents: true,
    autoImportComposables: true
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    provider: 'iconify'
  },

  llms: {
    domain: siteUrl,
    title: 'Vue Board',
    description: 'Interactive documentation for Vue Board and Nuxt Board.',
    full: {
      title: 'Vue Board Documentation',
      description: 'Guides, examples, API references, and OSS contributor documentation for Vue Board.'
    },
    sections: [
      {
        title: 'Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/getting-started%' }
        ]
      },
      {
        title: 'Learn',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/guides%' }
        ]
      },
      {
        title: 'Examples',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/examples%' }
        ]
      },
      {
        title: 'Cookbook',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/cookbook%' }
        ]
      },
      {
        title: 'API',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/api%' }
        ]
      }
    ]
  },

  mcp: {
    name: 'Vue Board Docs'
  }
})
