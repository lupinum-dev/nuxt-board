/** @vitest-environment jsdom */

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'
import { BoardMinimap, useBoardMinimap } from '../src/minimap'

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  init: PointerEventInit & { pointerId?: number },
) {
  const EventCtor = window.PointerEvent ?? window.MouseEvent
  const event = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  })

  if (!('pointerId' in event) && init.pointerId !== undefined) {
    Object.defineProperty(event, 'pointerId', {
      configurable: true,
      value: init.pointerId,
    })
  }

  target.dispatchEvent(event)
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 120,
        width: 200,
        height: 120,
        toJSON() {
          return this
        },
      }
    },
  })
})

describe('BoardMinimap', () => {
  it('resolves the enclosing board in the composable', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', x: 10, y: 20, width: 100, height: 80 })
    const Reader = defineComponent({
      setup() {
        const minimap = useBoardMinimap()
        return () => h('output', minimap.minimapNodes.value.length)
      },
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: { viewport: () => h(Reader) },
    })

    expect(wrapper.find('output').text()).toBe('1')
  })

  it('renders 10,000 projected nodes without per-node DOM elements', () => {
    const engine = createBoardEngine()
    engine.batch(() => {
      for (let index = 0; index < 10_000; index += 1) {
        engine.createNode({
          type: 'text',
          x: (index % 100) * 20,
          y: Math.floor(index / 100) * 20,
          width: 16,
          height: 16,
          select: false,
        })
      }
    })

    const wrapper = mount(BoardMinimap, {
      props: { engine, width: 200, height: 120 },
    })

    expect(wrapper.findAll('svg path')).toHaveLength(1)
    expect(wrapper.element.childElementCount).toBe(1)
    wrapper.unmount()
  })

  it('pans continuously while dragging across the minimap', async () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })

    const wrapper = mount(BoardMinimap, {
      props: {
        engine,
        width: 200,
        height: 120,
      },
      attachTo: document.body,
    })

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 60,
    })
    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 1,
      clientX: 150,
      clientY: 60,
    })
    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 1,
      clientX: 150,
      clientY: 60,
    })

    const visible = engine.getVisibleBounds(400, 300)
    const worldAtViewportCenter = {
      x: (visible.minX + visible.maxX) / 2,
      y: (visible.minY + visible.maxY) / 2,
    }

    expect(worldAtViewportCenter.x).toBeGreaterThan(350)
    expect(worldAtViewportCenter.y).toBeCloseTo(240, 0)
    wrapper.unmount()
  })

  it('reprojects nodes when component dimensions change', async () => {
    const engine = createBoardEngine()
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })
    const wrapper = mount(BoardMinimap, {
      props: { engine, width: 200, height: 120 },
      slots: {
        default: ({ nodes }) =>
          h('output', {
            class: 'projected-node',
            'data-width': nodes[0]?.width,
          }),
      },
    })
    const before = Number(
      wrapper.find('.projected-node').attributes('data-width'),
    )

    await wrapper.setProps({ width: 400, height: 240 })

    const after = Number(
      wrapper.find('.projected-node').attributes('data-width'),
    )
    expect(after).toBeGreaterThan(before)
  })

  it('supports keyboard camera navigation without bubbling to the board', async () => {
    const engine = createBoardEngine()
    const wrapper = mount(BoardMinimap, { props: { engine } })
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })

    wrapper.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(engine.$camera.get().x).toBe(-24)
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('role')).toBe('region')
  })
})
