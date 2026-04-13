/** @vitest-environment jsdom */

import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import { BoardConnectionLayer, connectionPlugin } from '../src'

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON() {
          return this
        }
      }
    }
  })
})

describe('BoardConnectionLayer', () => {
  it('rerenders path geometry when nodes move', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const source = engine.createNode({ type: 'text', x: 0, y: 0, width: 120, height: 80, data: { content: 'A' } })
    const target = engine.createNode({ type: 'text', x: 280, y: 120, width: 120, height: 80, data: { content: 'B' } })
    engine.ext.connections.createEdge({ from: source.id, to: target.id, label: 'sync', data: {} })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer)
      },
      attachTo: document.body
    })

    await nextTick()
    const before = wrapper.find('.board-connection-layer > path').attributes('d')
    engine.updateNode(target.id, { x: 420, y: 40 })
    await nextTick()
    await nextTick()
    const after = wrapper.find('.board-connection-layer > path').attributes('d')

    expect(before).not.toBe(after)
  })

  it('exposes resolved endpoints and route metadata to the edge slot', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const source = engine.createNode({ type: 'text', x: 40, y: 40, width: 120, height: 80, data: { content: 'A' } })
    const target = engine.createNode({ type: 'text', x: 260, y: 160, width: 120, height: 80, data: { content: 'B' } })
    engine.ext.connections.createEdge({ from: source.id, to: target.id, toEnd: 'arrow', data: {} })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () =>
          h(BoardConnectionLayer, null, {
            edge: ({
              source,
              target,
              route
            }: {
              source: { side: string }
              target: { side: string }
              route: { routing: string; path: string }
            }) =>
              h('div', { class: 'edge-slot' }, `${source.side}|${target.side}|${route.routing}|${route.path.includes('C')}`)
          })
      },
      attachTo: document.body
    })

    await nextTick()
    expect(wrapper.find('.edge-slot').text()).toMatch(/right\|left\|bezier\|true/)
  })
})
