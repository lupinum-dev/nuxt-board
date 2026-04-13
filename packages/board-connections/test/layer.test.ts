/** @vitest-environment jsdom */

import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import { BoardConnectionLayer, connectionPlugin } from '../src'

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  init: PointerEventInit & { pointerId?: number }
) {
  const EventCtor = window.PointerEvent ?? window.MouseEvent
  const event = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    ...init
  })

  if (!('pointerId' in event) && init.pointerId !== undefined) {
    Object.defineProperty(event, 'pointerId', {
      configurable: true,
      value: init.pointerId
    })
  }

  target.dispatchEvent(event)
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn()
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn()
  })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn().mockReturnValue(true)
  })
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
    const before = wrapper.find('.board-connection-layer > g > path:not([data-connection-hit])').attributes('d')
    engine.updateNode(target.id, { x: 420, y: 40 })
    await nextTick()
    await nextTick()
    const after = wrapper.find('.board-connection-layer > g > path:not([data-connection-hit])').attributes('d')

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

  it('reveals endpoint handles on hover and selects edges on pointerdown', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const source = engine.createNode({ type: 'text', x: 20, y: 20, width: 120, height: 80, data: { content: 'A' } })
    const target = engine.createNode({ type: 'text', x: 260, y: 20, width: 120, height: 80, data: { content: 'B' } })
    engine.ext.connections.createEdge({ from: source.id, to: target.id, data: {} })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer)
      },
      attachTo: document.body
    })

    await nextTick()
    expect(wrapper.find('[data-connection-handle="from"]').exists()).toBe(false)

    const hit = wrapper.find('[data-connection-hit="true"]').element
    dispatchPointerEvent(hit, 'pointermove', { pointerId: 1, clientX: 140, clientY: 60 })
    await nextTick()
    expect(wrapper.find('[data-connection-handle="from"]').exists()).toBe(true)
    expect(wrapper.find('[data-connection-handle="to"]').exists()).toBe(true)

    dispatchPointerEvent(hit, 'pointerdown', { pointerId: 1, button: 0, clientX: 140, clientY: 60 })
    await nextTick()
    expect(wrapper.find('[data-connection-handle="from"]').exists()).toBe(true)
  })

  it('reconnects a dragged handle to another node and stays idle in the board engine', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const source = engine.createNode({ type: 'text', x: 20, y: 20, width: 120, height: 80, data: { content: 'A' } })
    const mid = engine.createNode({ type: 'text', x: 260, y: 20, width: 120, height: 80, data: { content: 'B' } })
    const target = engine.createNode({ type: 'text', x: 500, y: 20, width: 120, height: 80, data: { content: 'C' } })
    const edge = engine.ext.connections.createEdge({
      from: source.id,
      to: mid.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: { side: 'left', offset: 0.75 },
      data: {}
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer)
      },
      attachTo: document.body
    })

    await nextTick()
    const hit = wrapper.find('[data-connection-hit="true"]').element
    dispatchPointerEvent(hit, 'pointermove', { pointerId: 2, clientX: 150, clientY: 60 })
    await nextTick()

    const handle = wrapper.find('[data-connection-handle="to"]').element
    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 2, button: 0, clientX: 260, clientY: 60 })
    await nextTick()

    dispatchPointerEvent(window, 'pointermove', { pointerId: 2, clientX: 560, clientY: 60 })
    await nextTick()
    await nextTick()
    expect(wrapper.find('.board-connection-layer rect').exists()).toBe(true)

    dispatchPointerEvent(window, 'pointerup', { pointerId: 2, clientX: 560, clientY: 60 })
    await nextTick()
    await nextTick()

    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'idle' })
    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: undefined
    })
  })

  it('cancels reconnect when the dragged endpoint is dropped off-node', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const source = engine.createNode({ type: 'text', x: 20, y: 20, width: 120, height: 80, data: { content: 'A' } })
    const target = engine.createNode({ type: 'text', x: 260, y: 20, width: 120, height: 80, data: { content: 'B' } })
    const edge = engine.ext.connections.createEdge({ from: source.id, to: target.id, data: {} })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer)
      },
      attachTo: document.body
    })

    await nextTick()
    const hit = wrapper.find('[data-connection-hit="true"]').element
    dispatchPointerEvent(hit, 'pointermove', { pointerId: 3, clientX: 150, clientY: 60 })
    await nextTick()

    const handle = wrapper.find('[data-connection-handle="from"]').element
    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 3, button: 0, clientX: 140, clientY: 60 })
    await nextTick()

    dispatchPointerEvent(window, 'pointermove', { pointerId: 3, clientX: 740, clientY: 440 })
    await nextTick()
    dispatchPointerEvent(window, 'pointerup', { pointerId: 3, clientX: 740, clientY: 440 })
    await nextTick()
    await nextTick()

    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      from: source.id,
      to: target.id
    })
  })
})
