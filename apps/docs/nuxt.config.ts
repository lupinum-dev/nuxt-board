import { fileURLToPath } from 'node:url'

const siteUrl =
  process.env.NUXT_PUBLIC_SITE_URL || 'https://vue-board.vercel.app'
const workspacePackage = (path: string) =>
  fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))
const nuxtBoardModule = workspacePackage('nuxt-board/src/module.ts')
const boardCoreInternal = workspacePackage('board-core/src/internal.ts')
const boardCore = workspacePackage('board-core/src/index.ts')
const vueBoard = workspacePackage('vue-board/src/index.ts')
const vueBoardStyle = workspacePackage('vue-board/dist/index.css')
const boardHistory = workspacePackage('board-history/src/index.ts')
const boardConnections = workspacePackage('board-connections/src/index.ts')
const boardConnectionsVue = workspacePackage('board-connections/src/vue.ts')
const boardMinimap = workspacePackage('vue-board/src/minimap.ts')

const customTags = {
  'basic-board-demo': 'LazyBasicBoardDemo',
  'connections-board-demo': 'LazyConnectionsBoardDemo',
  'document-session-lab': 'LazyDocumentSessionLab',
  'engine-command-lab': 'LazyEngineCommandLab',
  'event-logger': 'LazyEventLogger',
  'failed-transaction-lab': 'LazyFailedTransactionLab',
  'interaction-state-viz': 'LazyInteractionStateViz',
  'json-import-export-demo': 'LazyJsonImportExportDemo',
  'mind-map-demo': 'LazyMindMapDemo',
  'nuxt-auto-imports-demo': 'LazyNuxtAutoImportsDemo',
  'persistence-lab': 'LazyPersistenceLab',
  'read-only-toggle-demo': 'LazyReadOnlyToggleDemo',
  'renderer-board-demo': 'LazyRendererBoardDemo',
  'renderer-lab': 'LazyRendererLab',
  'theme-playground': 'LazyThemePlayground',
  'workflow-renderer-demo': 'LazyWorkflowRendererDemo',
} as const

const customPolicy = Object.fromEntries(
  Object.keys(customTags).map((name) => [
    name,
    { kind: 'block', props: {}, slots: ['default'], media: null },
  ]),
)

export default defineNuxtConfig({
  extends: ['@lupinum/ginko-docs'],
  modules: ['@nuxt/eslint', nuxtBoardModule],
  site: { url: siteUrl },
  components: [
    { path: '~/components/demos', pathPrefix: false, global: true },
    { path: '~/components/content', pathPrefix: false, global: true },
    { path: '~/components/mdc', pathPrefix: false, global: true },
  ],
  css: ['~/assets/css/main.css'],
  content: {
    componentPolicy: {
      components: {
        ...customPolicy,
        collapsible: {
          kind: 'block',
          props: {},
          slots: ['default'],
          media: null,
        },
        'code-tree': {
          kind: 'block',
          props: { defaultValue: { type: 'string', required: false } },
          slots: ['default'],
          media: null,
        },
        tip: {
          kind: 'block',
          props: { title: { type: 'string', required: false } },
          slots: ['default'],
          media: null,
        },
      },
    },
    markdown: {
      tags: {
        ...customTags,
        collapsible: 'MdcCollapsible',
        'code-tree': 'MdcCodeTree',
        tip: 'MdcIdea',
      },
    },
  },
  runtimeConfig: {
    public: {
      siteUrl,
      githubUrl: 'https://github.com/Mat4m0/canvas',
    },
  },
  alias: {
    '@lupinum/vue-board/style.css': vueBoardStyle,
    '@lupinum/board-core/internal': boardCoreInternal,
    '@lupinum/board-core': boardCore,
    '@lupinum/vue-board/minimap': boardMinimap,
    '@lupinum/vue-board': vueBoard,
    '@lupinum/board-history': boardHistory,
    '@lupinum/board-connections/vue': boardConnectionsVue,
    '@lupinum/board-connections': boardConnections,
  },
  vite: {
    resolve: {
      alias: [
        {
          find: /^@lupinum\/board-core\/internal$/,
          replacement: boardCoreInternal,
        },
        { find: /^@lupinum\/board-core$/, replacement: boardCore },
      ],
    },
  },
  board: {
    autoImportComponents: true,
    autoImportComposables: true,
  },
  compatibilityDate: '2025-07-15',
})
