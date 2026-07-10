import { defineNuxtModule, addComponent, addImports } from '@nuxt/kit'

/** Configuration for the `nuxt-board` module. */
export interface ModuleOptions {
  /**
   * Optional prefix for all auto-imported board exports.
   * Default: '' (no prefix). Example: 'My' → <MyBoardRoot>, useMyCamera(), createMyBoardEngine()
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
  'BoardSelectionToolbar',
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

const BOARD_HELPERS = ['createBoardEngine'] as const

const MINIMAP_COMPONENTS = ['BoardMinimap'] as const
const MINIMAP_COMPOSABLES = ['useMinimap'] as const

function normalizePrefix(prefix: string | undefined): string {
  const value = prefix?.trim() ?? ''
  const normalized = value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : ''

  if (normalized && !/^[A-Z][A-Za-z0-9]*$/.test(normalized)) {
    throw new Error(
      'nuxt-board: `board.prefix` must start with a letter and contain only letters or numbers.',
    )
  }

  return normalized
}

function getComponentAlias(name: string, prefix: string): string {
  return prefix ? `${prefix}${name}` : name
}

function getComposableAlias(name: string, prefix: string): string {
  return prefix ? `use${prefix}${name.slice(3)}` : name
}

function getHelperAlias(name: string, prefix: string): string {
  return prefix ? `create${prefix}${name.slice(6)}` : name
}

/** Nuxt module that auto-registers the board components and composables. */
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-board',
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
    const prefix = normalizePrefix(options.prefix)

    if (!nuxt.options.css.includes('@lupinum/vue-board/style.css')) {
      nuxt.options.css.push('@lupinum/vue-board/style.css')
    }

    for (const dependency of [
      '@lupinum/vue-board',
      '@lupinum/vue-board/minimap',
      '@lupinum/board-core',
    ]) {
      if (!nuxt.options.build.transpile.includes(dependency)) {
        nuxt.options.build.transpile.push(dependency)
      }
    }

    if (options.autoImportComponents !== false) {
      for (const name of BOARD_COMPONENTS) {
        addComponent({
          name: getComponentAlias(name, prefix),
          export: name,
          filePath: '@lupinum/vue-board',
        })
      }

      for (const name of MINIMAP_COMPONENTS) {
        addComponent({
          name: getComponentAlias(name, prefix),
          export: name,
          filePath: '@lupinum/vue-board/minimap',
        })
      }
    }

    if (options.autoImportComposables !== false) {
      addImports(
        BOARD_COMPOSABLES.map((name) => ({
          name,
          as: getComposableAlias(name, prefix),
          from: '@lupinum/vue-board',
        })),
      )

      addImports(
        MINIMAP_COMPOSABLES.map((name) => ({
          name,
          as: getComposableAlias(name, prefix),
          from: '@lupinum/vue-board/minimap',
        })),
      )

      addImports(
        BOARD_HELPERS.map((name) => ({
          name,
          as: getHelperAlias(name, prefix),
          from: '@lupinum/board-core',
        })),
      )
    }
  },
})
