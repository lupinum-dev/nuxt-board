import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import CanvasRoot from '../src/components/CanvasRoot.vue'

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

describe('CanvasRoot', () => {
  it('delegates pointerdown to node dragging and resizing', async () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ x: 40, y: 40, text: 'Drag me' })
    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    await wrapper.find(`[data-node-id="${node.id}"]`).trigger('pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 50
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'dragging-node',
      nodeId: node.id
    })

    await wrapper.find(`[data-resize="se"]`).trigger('pointerdown', {
      button: 0,
      pointerId: 2,
      clientX: 100,
      clientY: 100
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'resizing-node',
      nodeId: node.id,
      handle: 'se'
    })
  })

  it('uses middle mouse to pan even when starting on a node', async () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ x: 40, y: 40, text: 'Pan from here' })
    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    await wrapper.find(`[data-node-id="${node.id}"]`).trigger('pointerdown', {
      button: 1,
      pointerId: 7,
      clientX: 60,
      clientY: 60
    })

    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'panning',
      pointerId: 7
    })

    await wrapper.trigger('pointermove', {
      pointerId: 7,
      clientX: 110,
      clientY: 90
    })

    expect(engine.getSnapshot().camera).toMatchObject({
      x: 50,
      y: 30
    })
  })

  it('routes wheel events to pan or zoom', async () => {
    const engine = createCanvasEngine()
    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    wrapper.element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 10,
        deltaY: 20,
        clientX: 100,
        clientY: 100
      })
    )
    expect(engine.getSnapshot().camera).toMatchObject({ x: -10, y: -20 })

    wrapper.element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -10,
        clientX: 100,
        clientY: 100,
        ctrlKey: true
      })
    )
    expect(engine.getSnapshot().camera.z).toBeGreaterThan(1)
  })

  it('culls off-screen nodes', async () => {
    const engine = createCanvasEngine()
    engine.createNode({ x: 0, y: 0, text: 'Visible' })
    engine.createNode({ x: 5000, y: 5000, text: 'Far away' })

    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    expect(wrapper.findAll('[data-node-id]')).toHaveLength(1)
    engine.panByScreenDelta(5000, 5000)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-node-id]')).toHaveLength(1)
  })

  it('updates raster grid sizing as zoom changes', async () => {
    const engine = createCanvasEngine()
    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    const root = wrapper.find('.canvas-root')
    const minorBefore = root.attributes('data-grid-minor')
    const majorBefore = root.attributes('data-grid-major')

    engine.zoomAtScreenPoint({ x: 200, y: 160 }, -12)
    await wrapper.vm.$nextTick()

    expect(root.attributes('data-grid-minor')).not.toBe(minorBefore)
    expect(root.attributes('data-grid-major')).not.toBe(majorBefore)
  })

  it('supports hiding the raster grid with a prop', () => {
    const engine = createCanvasEngine()
    const wrapper = mount(CanvasRoot, {
      props: { engine, grid: false },
      attachTo: document.body
    })

    expect(wrapper.attributes('data-grid-visible')).toBe('false')
    expect(wrapper.find('.canvas-root__grid').exists()).toBe(false)
  })

  it('applies grid prop overrides to engine settings', async () => {
    const engine = createCanvasEngine()
    const wrapper = mount(CanvasRoot, {
      props: {
        engine,
        grid: {
          size: 24,
          majorEvery: 4,
          snap: false,
          minorOpacity: 0.2,
          majorOpacity: 0.3,
          fadeEdges: false
        }
      },
      attachTo: document.body
    })

    await wrapper.vm.$nextTick()

    expect(engine.getSnapshot().grid).toMatchObject({
      size: 24,
      majorEvery: 4,
      snap: false
    })
    expect(wrapper.find('.canvas-root').attributes('data-grid-minor')).toBe('24px')
  })

  it('suppresses drag transitions while editing text', async () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ x: 20, y: 20, text: 'Editable' })
    const wrapper = mount(CanvasRoot, {
      props: { engine },
      attachTo: document.body
    })

    await wrapper.find(`[data-node-id="${node.id}"]`).trigger('dblclick', {
      clientX: 30,
      clientY: 30
    })
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'editing-text',
      nodeId: node.id
    })

    await wrapper.find('textarea').trigger('pointerdown', {
      pointerId: 3,
      clientX: 30,
      clientY: 30
    })
    expect(engine.getSnapshot().interaction.mode).toBe('editing-text')
  })
})
