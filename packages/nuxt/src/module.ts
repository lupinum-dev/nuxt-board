import { defineNuxtModule, addComponent, addImports } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Optional prefix for all auto-imported canvas components.
   * Default: '' (no prefix). Example: 'My' → <MyCanvasRoot>, <MyCanvasNode> …
   */
  prefix?: string
  /**
   * Whether to auto-import canvas components (CanvasRoot, CanvasNode, etc.).
   * Default: true
   */
  autoImportComponents?: boolean
  /**
   * Whether to auto-import canvas composables (useCanvasEngine, useCamera, etc.).
   * Default: true
   */
  autoImportComposables?: boolean
}

const CANVAS_COMPONENTS = [
  'CanvasRoot',
  'CanvasViewport',
  'CanvasNode',
  'CanvasNodeHandle',
  'CanvasGrid',
  'CanvasBoxSelect',
  'CanvasSnapGuides',
] as const

const CANVAS_COMPOSABLES = [
  'useCanvasEngine',
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
    name: '@canvas/nuxt',
    configKey: 'canvas',
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
    for (const dependency of ['@canvas/vue', '@canvas/core']) {
      if (!nuxt.options.build.transpile.includes(dependency)) {
        nuxt.options.build.transpile.push(dependency)
      }
    }

    if (options.autoImportComponents !== false) {
      for (const name of CANVAS_COMPONENTS) {
        addComponent({
          name: `${prefix}${name}`,
          export: name,
          filePath: '@canvas/vue',
        })
      }
    }

    if (options.autoImportComposables !== false) {
      addImports(
        CANVAS_COMPOSABLES.map((name) => ({
          name,
          as: name,
          from: '@canvas/vue',
        }))
      )

      addImports({
        name: 'createCanvasEngine',
        as: 'createCanvasEngine',
        from: '@canvas/core',
      })
    }
  },
})
