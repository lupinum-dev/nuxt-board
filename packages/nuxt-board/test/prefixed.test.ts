import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('nuxt-board prefixed auto-imports', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/prefixed', import.meta.url)),
  })

  it('renders consistently prefixed aliases during SSR', async () => {
    const html = await $fetch('/')

    expect(html).toContain('prefixed-module-ok')
    expect(html).toContain('class="board-root"')
    expect(html).toContain('prefixed-node-content')
    expect(html).toContain('class="prefixed-board-probe"')
    expect(html).toContain('class="board-minimap"')
    expect(html).toContain('data-minimap-nodes="1"')
    expect(html).toContain('data-nodes="1"')
    expect(html).toContain('data-zoom="1"')
  })
})
