import { beforeEach, describe, expect, it, vi } from 'vitest'

const kit = vi.hoisted(() => ({
  addComponent: vi.fn(),
  addImports: vi.fn(),
}))

vi.mock('@nuxt/kit', () => ({
  addComponent: kit.addComponent,
  addImports: kit.addImports,
  defineNuxtModule: (definition: unknown) => definition,
}))

const { default: boardModule } = await import('../src/module')
const moduleDefinition = boardModule as unknown as {
  setup: (
    options: {
      prefix?: string
      autoImportComponents?: boolean
      autoImportComposables?: boolean
    },
    nuxt: unknown,
  ) => void
}

function setupModule(
  options: {
    prefix?: string
    autoImportComponents?: boolean
    autoImportComposables?: boolean
  } = {},
) {
  const nuxt = { options: { css: [] as string[] } }
  moduleDefinition.setup(options, nuxt)
  return nuxt
}

describe('nuxt-board module registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('honours both auto-import opt-outs while retaining the stylesheet', () => {
    const nuxt = setupModule({
      autoImportComponents: false,
      autoImportComposables: false,
    })

    expect(kit.addComponent).not.toHaveBeenCalled()
    expect(kit.addImports).not.toHaveBeenCalled()
    expect(nuxt.options.css).toEqual(['@lupinum/vue-board/style.css'])
  })

  it('normalizes a prefix across components, composables, and helpers', () => {
    setupModule({ prefix: 'acme' })

    expect(kit.addComponent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'AcmeBoardRoot', export: 'BoardRoot' }),
    )
    const imports = kit.addImports.mock.calls.flatMap(([entries]) => entries)
    expect(imports).toContainEqual(
      expect.objectContaining({
        name: 'useBoardCamera',
        as: 'useAcmeBoardCamera',
      }),
    )
    expect(imports).toContainEqual(
      expect.objectContaining({
        name: 'useBoardMinimap',
        as: 'useAcmeBoardMinimap',
      }),
    )
    expect(imports).toContainEqual(
      expect.objectContaining({
        name: 'createBoardEngine',
        as: 'createAcmeBoardEngine',
      }),
    )
  })

  it('registers only core and Vue imports without optional-package probing', () => {
    setupModule()

    const componentSources = kit.addComponent.mock.calls.map(
      ([component]) => component.filePath,
    )
    const importSources = kit.addImports.mock.calls
      .flatMap(([entries]) => entries)
      .map((entry) => entry.from)
    const sources = [...componentSources, ...importSources]

    expect(new Set(sources)).toEqual(
      new Set([
        '@lupinum/board-core',
        '@lupinum/vue-board',
        '@lupinum/vue-board/minimap',
      ]),
    )
    expect(sources).not.toContain('@lupinum/board-history')
    expect(sources).not.toContain('@lupinum/board-connections')
    expect(sources).not.toContain('@lupinum/board-connections/vue')
  })

  it.each(['9board', 'board-name', 'board name'])(
    'rejects the invalid prefix %s',
    (prefix) => {
      expect(() => setupModule({ prefix })).toThrow(/board\.prefix/)
    },
  )

  it('does not register the stylesheet twice', () => {
    const nuxt = { options: { css: ['@lupinum/vue-board/style.css'] } }
    moduleDefinition.setup({}, nuxt)

    expect(nuxt.options.css).toEqual(['@lupinum/vue-board/style.css'])
  })
})
