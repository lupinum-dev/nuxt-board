import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('docs source contracts', () => {
  it('keeps docs as an app, not a publishable package', () => {
    expect(() => read('apps/docs/package.json')).not.toThrow()
    expect(() => read('packages/docs/package.json')).toThrow()
  })

  it('does not pass runtime snapshots directly to importJSON in demos', () => {
    const files = [
      'apps/docs/app/components/demos/BasicBoardDemo.vue',
      'apps/docs/app/components/demos/ConnectionsBoardDemo.vue',
      'apps/docs/app/components/demos/EventLogger.vue',
      'apps/docs/app/components/demos/GridPatternDemo.vue',
      'apps/docs/app/components/demos/InteractionStateViz.vue',
      'apps/docs/app/components/demos/KeyboardExplorer.vue',
      'apps/docs/app/components/demos/NuxtAutoImportsDemo.vue',
      'apps/docs/app/components/demos/ReadOnlyToggleDemo.vue',
      'apps/docs/app/components/demos/SnapDemo.vue',
      'apps/docs/app/components/demos/ThemePlayground.vue',
    ]

    for (const file of files) {
      const source = read(file)

      expect(source, file).not.toMatch(/importJSON\(\s*JSON\.stringify\(\s*\{/s)
      expect(source, file).not.toMatch(/\bsnapGuides:\s*\[/)
      expect(source, file).not.toMatch(/\binteraction:\s*\{\s*mode:/)
    }

    expect(read('packages/nuxt-board/playground/lib/demo.ts')).not.toMatch(
      /importJSON\(\s*JSON\.stringify\(\s*\{/s,
    )
  })
})
