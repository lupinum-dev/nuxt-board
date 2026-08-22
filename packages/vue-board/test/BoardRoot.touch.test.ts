/** @vitest-environment jsdom */

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'

function dispatchPointer(
  element: Element,
  type: string,
  init: PointerEventInit & { pointerId: number },
): void {
  const EventCtor = window.PointerEvent ?? window.MouseEvent
  const event = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  if (!('pointerId' in event)) {
    Object.defineProperty(event, 'pointerId', { value: init.pointerId })
  }
  if (!('pointerType' in event)) {
    Object.defineProperty(event, 'pointerType', { value: init.pointerType })
  }
  element.dispatchEvent(event)
}

beforeEach(() => {
  for (const [name, value] of [
    ['setPointerCapture', vi.fn()],
    ['releasePointerCapture', vi.fn()],
    ['hasPointerCapture', vi.fn().mockReturnValue(true)],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value,
    })
  }
})

afterEach(() => vi.restoreAllMocks())

describe('BoardRoot touch interaction', () => {
  it('treats an empty-canvas touch as a tap or thresholded pan', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', text: 'Selected' })
    const wrapper = mount(BoardRoot, { props: { engine } })

    dispatchPointer(wrapper.element, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
      button: 0,
    })
    dispatchPointer(wrapper.element, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
    })
    expect(engine.getSelection()).toEqual([])

    dispatchPointer(wrapper.element, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
      button: 0,
    })
    dispatchPointer(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 303,
      clientY: 302,
    })
    expect(engine.getState().camera).toEqual({ x: 0, y: 0, z: 1 })
    dispatchPointer(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 330,
      clientY: 320,
    })
    dispatchPointer(wrapper.element, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
    })

    expect(engine.getState().camera).toMatchObject({ x: 30, y: 20 })
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
    expect(node.id).toBeDefined()
  })

  it('uses a second finger for midpoint pan and pinch zoom', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const wrapper = mount(BoardRoot, { props: { engine } })

    dispatchPointer(wrapper.element, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      button: 0,
    })
    dispatchPointer(wrapper.element, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 100,
      button: 0,
    })
    dispatchPointer(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 240,
      clientY: 120,
    })

    expect(engine.getState().camera.z).toBeGreaterThan(1)
    expect(engine.getState().camera.x).not.toBe(0)
    expect(engine.getState().camera.y).not.toBe(0)

    dispatchPointer(wrapper.element, 'pointercancel', {
      pointerId: 2,
      pointerType: 'touch',
    })
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
  })

  it.each(['drag', 'resize'] as const)(
    'rolls back an active touch %s when a second finger takes over',
    (kind) => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          callback(0)
          return 1
        },
      )
      const engine = createBoardEngine({ grid: { snap: false } })
      const node = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 120,
        height: 80,
      })
      const wrapper = mount(BoardRoot, { props: { engine } })
      const target =
        kind === 'drag'
          ? wrapper.find(`[data-node-id="${node.id}"]`).element
          : wrapper.find('[data-resize="se"]').element
      const start = kind === 'drag' ? { x: 40, y: 40 } : { x: 140, y: 100 }

      dispatchPointer(target, 'pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: start.x,
        clientY: start.y,
        button: 0,
      })
      dispatchPointer(target, 'pointermove', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: start.x + 30,
        clientY: start.y + 20,
      })
      dispatchPointer(wrapper.element, 'pointerdown', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 220,
        clientY: 120,
        button: 0,
      })

      expect(engine.getNode(node.id)).toMatchObject({
        x: 20,
        y: 20,
        width: 120,
        height: 80,
      })
      expect(engine.getState().interaction).toEqual({ mode: 'idle' })
    },
  )

  it('keeps touch node drag and resize available', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
    })
    const wrapper = mount(BoardRoot, { props: { engine } })
    const nodeElement = wrapper.find(`[data-node-id="${node.id}"]`).element

    dispatchPointer(nodeElement, 'pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40,
      button: 0,
    })
    dispatchPointer(nodeElement, 'pointermove', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 80,
      clientY: 70,
    })
    dispatchPointer(nodeElement, 'pointerup', {
      pointerId: 7,
      pointerType: 'touch',
    })
    expect(engine.getNode(node.id)).toMatchObject({ x: 60, y: 50 })

    const handle = wrapper.find('[data-resize="se"]').element
    dispatchPointer(handle, 'pointerdown', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 180,
      clientY: 130,
      button: 0,
    })
    dispatchPointer(handle, 'pointermove', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 210,
      clientY: 150,
    })
    dispatchPointer(handle, 'pointerup', {
      pointerId: 8,
      pointerType: 'touch',
    })
    expect(engine.getNode(node.id).width).toBeGreaterThan(120)
    expect(engine.getNode(node.id).height).toBeGreaterThan(80)
  })
})
