/** @vitest-environment jsdom */

import { defineComponent, h, markRaw, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'

function dispatchPointerEvent(
  element: Element,
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

  element.dispatchEvent(event)
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

describe('BoardRoot', () => {
  it('starts drag and resize only after the pointer clears the movement threshold', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 40, y: 40, data: { content: 'Drag me' } })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body
    })

    dispatchPointerEvent(wrapper.find(`[data-node-id="${node.id}"]`).element, 'pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 50
    })
    expect(engine.getSelection()).toEqual([node.id])
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle'
    })

    dispatchPointerEvent(wrapper.find(`[data-node-id="${node.id}"]`).element, 'pointermove', {
      pointerId: 1,
      clientX: 53,
      clientY: 52
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle'
    })

    dispatchPointerEvent(wrapper.find(`[data-node-id="${node.id}"]`).element, 'pointermove', {
      pointerId: 1,
      clientX: 66,
      clientY: 58
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'dragging-nodes'
    })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 1,
      clientX: 66,
      clientY: 58
    })

    await nextTick()
    dispatchPointerEvent(wrapper.find(`[data-node-id="${node.id}"]`).element, 'pointerdown', {
      button: 0,
      pointerId: 2,
      clientX: 46,
      clientY: 46
    })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 2,
      clientX: 46,
      clientY: 46
    })
    await nextTick()

    dispatchPointerEvent(wrapper.find('[data-resize="se"]').element, 'pointerdown', {
      button: 0,
      pointerId: 3,
      clientX: 120,
      clientY: 110
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle'
    })

    dispatchPointerEvent(wrapper.find('[data-resize="se"]').element, 'pointermove', {
      pointerId: 3,
      clientX: 132,
      clientY: 122
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'resizing-node',
      nodeId: node.id,
      handle: 'se'
    })
  })

  it('renders a registry renderer for typed nodes', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'image', x: 40, y: 40, data: { alt: 'Poster' } })
    const ImageRenderer = markRaw(defineComponent({
      props: ['node'],
      setup(props) {
        return () => h('div', { class: 'image-renderer' }, String((props.node.data as Record<string, unknown>).alt))
      }
    }))

    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        renderers: {
          image: ImageRenderer
        }
      },
      attachTo: document.body
    })

    expect(wrapper.find('.image-renderer').text()).toContain('Poster')
  })

  it('draws a box select and updates selection from background drag', async () => {
    const engine = createBoardEngine()
    const first = engine.createNode({ type: 'text', x: 20, y: 20, width: 80, height: 60, data: { content: 'A' } })
    engine.createNode({ type: 'text', x: 420, y: 320, width: 80, height: 60, data: { content: 'B' } })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body
    })

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0
    })
    dispatchPointerEvent(wrapper.element, 'pointermove', {
      pointerId: 7,
      clientX: 180,
      clientY: 140
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.board-box-select').exists()).toBe(true)

    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 7,
      clientX: 180,
      clientY: 140
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(engine.getSelection()).toEqual([first.id])
  })

  it('supports keyboard duplicate and delete shortcuts', async () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', x: 40, y: 40, data: { content: 'Keyboard' } })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body
    })

    await wrapper.trigger('keydown', { key: 'a', ctrlKey: true })
    await wrapper.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(engine.getSnapshot().nodes).toHaveLength(2)

    await wrapper.trigger('keydown', { key: 'Delete' })
    expect(engine.getSnapshot().nodes).toHaveLength(1)
  })

  it('duplicates the current selection when alt-dragging past the threshold', async () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 40, y: 40, data: { content: 'Clone me' } })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body
    })

    const element = wrapper.find(`[data-node-id="${node.id}"]`).element
    dispatchPointerEvent(element, 'pointerdown', {
      button: 0,
      pointerId: 12,
      altKey: true,
      clientX: 60,
      clientY: 60
    })
    dispatchPointerEvent(element, 'pointermove', {
      pointerId: 12,
      altKey: true,
      clientX: 84,
      clientY: 84
    })
    await nextTick()

    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'dragging-nodes' })
    expect(engine.getSelection()).toHaveLength(1)
  })

  it('applies grid visibility and pattern overrides', async () => {
    const engine = createBoardEngine()
    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        grid: {
          visible: true,
          pattern: 'dot',
          size: 24,
          majorEvery: 4,
          snap: false
        }
      },
      attachTo: document.body
    })

    await wrapper.vm.$nextTick()

    expect(engine.getSnapshot().grid).toMatchObject({
      pattern: 'dot',
      size: 24,
      majorEvery: 4,
      snap: false
    })
    expect(wrapper.find('.board-grid').exists()).toBe(true)
  })

  it('ignores connection-layer interactive targets for board interactions', () => {
    const engine = createBoardEngine()
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body
    })

    const interactive = document.createElement('div')
    interactive.dataset.boardInteractive = 'true'
    wrapper.element.appendChild(interactive)

    dispatchPointerEvent(interactive, 'pointerdown', {
      button: 0,
      pointerId: 11,
      clientX: 120,
      clientY: 120
    })

    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'idle' })
  })
})
