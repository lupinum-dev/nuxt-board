/** @vitest-environment node */

import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'
import { BoardMinimap } from '../src/minimap'

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
          text: 'Server rendered node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
      ],
    })

    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(BoardRoot, { engine, style: 'width: 640px; height: 360px;' }),
      }),
    )

    expect(html).toContain('class="board-root"')
    expect(html).toContain('data-node-id="hero"')
    expect(html).toContain('Server rendered node')
  })

  it('does not retain engine subscriptions during server rendering', async () => {
    const engine = createBoardEngine()
    const subscribeSpies = [
      vi.spyOn(engine.$camera, 'subscribe'),
      vi.spyOn(engine.$grid, 'subscribe'),
      vi.spyOn(engine.$nodes, 'subscribe'),
      vi.spyOn(engine.$selection, 'subscribe'),
      vi.spyOn(engine.$interaction, 'subscribe'),
      vi.spyOn(engine.$snapGuides, 'subscribe'),
    ]
    const eventSpy = vi.spyOn(engine, 'on')

    await renderToString(
      createSSRApp({
        render: () =>
          h(
            BoardRoot,
            { engine },
            { default: () => h(BoardMinimap, { engine }) },
          ),
      }),
    )

    for (const subscribe of subscribeSpies) {
      expect(subscribe).not.toHaveBeenCalled()
    }
    expect(eventSpy).not.toHaveBeenCalled()
  })
})
