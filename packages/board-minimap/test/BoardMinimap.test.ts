/** @vitest-environment jsdom */

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { BoardMinimap } from '../src'

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
})
