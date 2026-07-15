import { fileURLToPath } from 'node:url'

const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://vue-board.vercel.app'
const workspacePackage = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))
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
  'basic-board-demo': 'BasicBoardDemo',
  'connections-board-demo': 'ConnectionsBoardDemo',
  'document-session-lab': 'DocumentSessionLab',
  'engine-command-lab': 'EngineCommandLab',
  'event-logger': 'EventLogger',
  'failed-transaction-lab': 'FailedTransactionLab',
  'interaction-state-viz': 'InteractionStateViz',
  'json-import-export-demo': 'JsonImportExportDemo',
  'mind-map-demo': 'MindMapDemo',
  'nuxt-auto-imports-demo': 'NuxtAutoImportsDemo',
  'persistence-lab': 'PersistenceLab',
  'read-only-toggle-demo': 'ReadOnlyToggleDemo',
  'renderer-board-demo': 'RendererBoardDemo',
  'renderer-lab': 'RendererLab',
  'theme-playground': 'ThemePlayground',
  'workflow-renderer-demo': 'WorkflowRendererDemo'
} as const

const customPolicy = Object.fromEntries(
  Object.keys(customTags).map((name) => [name, { kind: 'block', props: {}, slots: ['default'], media: null }])
)

export default defineNuxtConfig({
  extends: ['@lupinum/ginko-docs'],
  modules: ['@nuxt/eslint', nuxtBoardModule],
  site: { url: siteUrl },
  components: [
    { path: '~/components/demos', pathPrefix: false, global: true },
    { path: '~/components/content', pathPrefix: false, global: true },
    { path: '~/components/mdc', pathPrefix: false, global: true }
  ],
  css: ['~/assets/css/main.css'],
  content: {
    componentPolicy: {
      components: {
        ...customPolicy,
        collapsible: { kind: 'block', props: {}, slots: ['default'], media: null },
        'code-tree': {
          kind: 'block',
          props: { defaultValue: { type: 'string', required: false } },
          slots: ['default'],
          media: null
        },
        tip: {
          kind: 'block',
          props: { title: { type: 'string', required: false } },
          slots: ['default'],
          media: null
        }
      }
    },
    markdown: {
      tags: {
        ...customTags,
        collapsible: 'MdcCollapsible',
        'code-tree': 'MdcCodeTree',
        tip: 'MdcIdea'
      }
    }
  },
  runtimeConfig: {
    public: {
      siteUrl,
      githubUrl: 'https://github.com/lupinum-dev/nuxt-board'
    }
  },
  alias: {
    '@lupinum/vue-board/style.css': vueBoardStyle,
    '@lupinum/board-core/internal': boardCoreInternal,
    '@lupinum/board-core': boardCore,
    '@lupinum/vue-board/minimap': boardMinimap,
    '@lupinum/vue-board': vueBoard,
    '@lupinum/board-history': boardHistory,
    '@lupinum/board-connections/vue': boardConnectionsVue,
    '@lupinum/board-connections': boardConnections
  },
  vite: {
    resolve: {
      alias: [
        { find: /^@lupinum\/board-core\/internal$/, replacement: boardCoreInternal },
        { find: /^@lupinum\/board-core$/, replacement: boardCore }
      ]
    }
  },
  routeRules: {
    '/getting-started/introduction': { redirect: '/docs/evaluate/why-vue-board' },
    '/getting-started/installation': { redirect: '/docs/start-building/installation' },
    '/getting-started/quick-start': { redirect: '/docs/start-building/your-first-board' },
    '/essentials/core-concepts': { redirect: '/docs/evaluate/how-vue-board-works' },
    '/essentials/nodes': { redirect: '/docs/understand-the-system/nodes-and-hierarchy' },
    '/essentials/camera': { redirect: '/docs/understand-the-system/camera-and-coordinates' },
    '/essentials/selection': { redirect: '/docs/build-features/selection-and-keyboard' },
    '/guides/connections': { redirect: '/docs/build-features/connections' },
    '/guides/history': { redirect: '/docs/build-features/undo-and-redo' },
    '/guides/theming': { redirect: '/docs/build-features/theming' },
    '/examples/mind-map': { redirect: '/docs/solutions/mind-map' },
    '/api/board-core': { redirect: '/docs/reference/board-core' },
    '/api/vue-board': { redirect: '/docs/reference/vue-board' }
  },
  board: {
    autoImportComponents: true,
    autoImportComposables: true
  },
  compatibilityDate: '2025-07-15'
})
