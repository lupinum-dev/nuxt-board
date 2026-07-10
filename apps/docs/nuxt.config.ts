import { fileURLToPath } from 'node:url'

const siteUrl =
  process.env.NUXT_PUBLIC_SITE_URL || 'https://vue-board.vercel.app'

function workspacePackage(path: string): string {
  return fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))
}

const nuxtBoardModule = workspacePackage('nuxt-board/src/module.ts')
const vueBoardStyle = workspacePackage('vue-board/dist/index.css')
const boardCoreInternal = workspacePackage('board-core/src/internal.ts')
const boardCore = workspacePackage('board-core/src/index.ts')
const vueBoard = workspacePackage('vue-board/src/index.ts')
const boardHistory = workspacePackage('board-history/src/index.ts')
const boardConnections = workspacePackage('board-connections/src/index.ts')
const boardConnectionsVue = workspacePackage('board-connections/src/vue.ts')
const boardMinimap = workspacePackage('vue-board/src/minimap.ts')

export default defineNuxtConfig({
  modules: [
    nuxtBoardModule,
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-llms',
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
    '@lupinum/vue-board/style.css': vueBoardStyle,
    '@lupinum/board-core/internal': boardCoreInternal,
    '@lupinum/board-core': boardCore,
    '@lupinum/vue-board': vueBoard,
    '@lupinum/board-history': boardHistory,
    '@lupinum/board-connections': boardConnections,
    '@lupinum/board-connections/vue': boardConnectionsVue,
    '@lupinum/vue-board/minimap': boardMinimap,
  },

  experimental: {
    asyncContext: true,
  },

  compatibilityDate: '2024-07-11',

  vite: {
    optimizeDeps: {
      include: [],
    },
    resolve: {
      alias: [
        {
          find: /^@lupinum\/board-core\/internal$/,
          replacement: boardCoreInternal,
        },
        {
          find: /^@lupinum\/board-core$/,
          replacement: boardCore,
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
    clientBundle: {
      icons: [
        'lucide:arrow-left',
        'lucide:arrow-up-right',
        'lucide:book-open',
        'lucide:chef-hat',
        'lucide:code-xml',
        'lucide:hash',
        'lucide:heart-handshake',
        'lucide:info',
        'lucide:lightbulb',
        'lucide:menu',
        'lucide:radio',
        'lucide:triangle-alert',
        'tabler:brand-github',
        'tabler:player-play',
        'tabler:star',
        'vscode-icons:file-type-nuxt',
        'vscode-icons:file-type-npm',
        'vscode-icons:file-type-pnpm',
        'vscode-icons:file-type-typescript',
        'vscode-icons:file-type-vue',
        'vscode-icons:file-type-yarn',
      ],
      scan: true,
    },
    provider: 'none',
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
      {
        title: 'OSS',
        contentCollection: 'docs',
        contentFilters: [{ field: 'path', operator: 'LIKE', value: '/oss%' }],
      },
    ],
  },
})
