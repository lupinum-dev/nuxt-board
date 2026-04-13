import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('@canvas/nuxt module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    // Use dev mode to avoid a CJS/ESM interop issue with magic-string
    // that only occurs during Rollup production builds inside the test runner.
    dev: true,
  })

  it('renders static page content server-side', async () => {
    const html = await $fetch('/')
    expect(html).toContain('canvas-module-ok')
  })

  it('does not server-render the canvas DOM (client-only component)', async () => {
    const html = await $fetch('/')
    // CanvasRoot is mode:client, so its .canvas-root div must not appear in SSR HTML
    expect(html).not.toContain('class="canvas-root"')
  })
})
