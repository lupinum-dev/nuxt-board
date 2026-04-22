import { defineNuxtModule, addComponent, addImports } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Optional prefix for all auto-imported board components.
   * Default: '' (no prefix). Example: 'My' → <MyBoardRoot>, <MyBoardNode> …
   */
  prefix?: string
  /**
   * Whether to auto-import board components (BoardRoot, BoardNode, etc.).
   * Default: true
   */
  autoImportComponents?: boolean
  /**
   * Whether to auto-import board composables (useBoardEngine, useCamera, etc.).
   * Default: true
   */
  autoImportComposables?: boolean
}

const BOARD_COMPONENTS = [
  'BoardRoot',
  'BoardViewport',
  'BoardNode',
  'BoardNodeHandle',
  'BoardGrid',
  'BoardBoxSelect',
  'BoardSnapGuides',
] as const

const BOARD_COMPOSABLES = [
  'useBoardEngine',
  'useCamera',
  'useNodes',
  'useSelection',
  'useInteraction',
  'useVisibleBounds',
  'useVisibleNodes',
  'useGridStyle',
  'useNode',
  'useBoxSelectBounds',
] as const

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@lupinum/nuxt-board',
    configKey: 'board',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {
    prefix: '',
    autoImportComponents: true,
    autoImportComposables: true,
  },
  setup(options, nuxt) {
    const prefix = options.prefix ?? ''
    for (const dependency of ['@lupinum/vue-board', '@lupinum/board-core']) {
      if (!nuxt.options.build.transpile.includes(dependency)) {
        nuxt.options.build.transpile.push(dependency)
      }
    }

    if (options.autoImportComponents !== false) {
      for (const name of BOARD_COMPONENTS) {
        addComponent({
          name: `${prefix}${name}`,
          export: name,
          filePath: '@lupinum/vue-board',
        })
      }
    }

    if (options.autoImportComposables !== false) {
      addImports(
        BOARD_COMPOSABLES.map((name) => ({
          name,
          as: name,
          from: '@lupinum/vue-board',
        })),
      )

      addImports({
        name: 'createBoardEngine',
        as: 'createBoardEngine',
        from: '@lupinum/board-core',
      })
    }
  },
})
