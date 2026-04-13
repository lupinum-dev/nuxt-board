/** @vitest-environment node */

import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { asNodeId, createCanvasEngine } from '@canvas/core'
import CanvasRoot from '../src/components/CanvasRoot.vue'

describe('CanvasRoot SSR', () => {
  it('renders canvas markup and initial nodes before mount', async () => {
    const engine = createCanvasEngine({
      initialNodes: [
        {
          id: asNodeId('hero'),
          type: 'text',
          x: 64,
          y: 48,
          width: 220,
          height: 120,
          data: { content: 'Server rendered node' },
          zIndex: 1,
          locked: false,
          visible: true
        }
      ]
    })

    const html = await renderToString(createSSRApp({
      render: () => h(CanvasRoot, { engine, style: 'width: 640px; height: 360px;' })
    }))

    expect(html).toContain('class="canvas-root"')
    expect(html).toContain('data-node-id="hero"')
    expect(html).toContain('Server rendered node')
  })
})
