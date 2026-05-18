import { fileURLToPath } from 'node:url'

const siteUrl =
  process.env.NUXT_PUBLIC_SITE_URL || 'https://vue-board.vercel.app'

export default defineNuxtConfig({
  modules: [
    fileURLToPath(
      new URL('../../packages/nuxt-board/src/module.ts', import.meta.url),
    ),
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms',
    '@nuxtjs/mcp-toolkit',
  ],

  components: [
    {
      path: '~/components/demos',
      pathPrefix: false,
    },
    '~/components',
  ],

  devtools: {
    enabled: process.env.NUXT_DEVTOOLS === 'true',
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: siteUrl,
    name: 'Vue Board',
  },

  colorMode: {
    classSuffix: '',
    dataValue: 'theme',
  },

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 3,
        },
      },
    },
  },

  runtimeConfig: {
    public: {
      siteUrl,
      githubUrl: 'https://github.com/lupinum/nuxt-board',
    },
  },

  alias: {
    '@lupinum/vue-board/style.css': fileURLToPath(
      new URL('../../packages/vue-board/dist/index.css', import.meta.url),
    ),
    '@lupinum/board-core/internal': fileURLToPath(
      new URL('../../packages/board-core/src/internal.ts', import.meta.url),
    ),
    '@lupinum/board-core': fileURLToPath(
      new URL('../../packages/board-core/src/index.ts', import.meta.url),
    ),
    '@lupinum/vue-board': fileURLToPath(
      new URL('../../packages/vue-board/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-history': fileURLToPath(
      new URL('../../packages/board-history/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-connections': fileURLToPath(
      new URL('../../packages/board-connections/src/index.ts', import.meta.url),
    ),
    '@lupinum/board-minimap': fileURLToPath(
      new URL('../../packages/board-minimap/src/index.ts', import.meta.url),
    ),
  },

  experimental: {
    asyncContext: true,
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: ['/', '/getting-started/introduction', '/examples/basic-board'],
      ignore: [/^\/_og\//],
      crawlLinks: true,
      autoSubfolderIndex: false,
    },
  },

  vite: {
    resolve: {
      alias: [
        {
          find: /^@lupinum\/board-core\/internal$/,
          replacement: fileURLToPath(
            new URL(
              '../../packages/board-core/src/internal.ts',
              import.meta.url,
            ),
          ),
        },
        {
          find: /^@lupinum\/board-core$/,
          replacement: fileURLToPath(
            new URL('../../packages/board-core/src/index.ts', import.meta.url),
          ),
        },
      ],
    },
  },

  board: {
    autoImportComponents: true,
    autoImportComposables: true,
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },

  icon: {
    fetchTimeout: 10000,
    provider: 'server',
    serverBundle: 'local',
  },

  llms: {
    domain: siteUrl,
    title: 'Vue Board',
    description: 'Interactive documentation for Vue Board and Nuxt Board.',
    full: {
      title: 'Vue Board Documentation',
      description:
        'Guides, examples, API references, and OSS contributor documentation for Vue Board.',
    },
    sections: [
      {
        title: 'Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/getting-started%' },
        ],
      },
      {
        title: 'Essentials',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/essentials%' },
        ],
      },
      {
        title: 'Guides',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/guides%' },
        ],
      },
      {
        title: 'Examples',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/examples%' },
        ],
      },
      {
        title: 'Cookbook',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/cookbook%' },
        ],
      },
      {
        title: 'API',
        contentCollection: 'docs',
        contentFilters: [{ field: 'path', operator: 'LIKE', value: '/api%' }],
      },
      {
        title: 'Events',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/events%' },
        ],
      },
    ],
  },

  mcp: {
    name: 'Vue Board Docs',
  },
})
