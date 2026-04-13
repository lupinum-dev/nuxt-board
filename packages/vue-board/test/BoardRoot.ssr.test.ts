/** @vitest-environment node */

import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'

describe('BoardRoot SSR', () => {
  it('renders board markup and initial nodes before mount', async () => {
    const engine = createBoardEngine({
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
      render: () => h(BoardRoot, { engine, style: 'width: 640px; height: 360px;' })
    }))

    expect(html).toContain('class="board-root"')
    expect(html).toContain('data-node-id="hero"')
    expect(html).toContain('Server rendered node')
  })
})
