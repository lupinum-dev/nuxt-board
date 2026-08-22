/** @vitest-environment jsdom */

import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'
import BoardRoot from '../src/components/BoardRoot.vue'

function dispatchPaste(element: Element, text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text, files: [] },
  })
  element.dispatchEvent(event)
  return event
}

describe('BoardRoot clipboard and context menus', () => {
  it('cuts the selection as one history frame', async () => {
    const engine = createBoardEngine({ plugins: [historyPlugin()] })
    engine.createNode({ type: 'text', text: 'Cut me' })
    engine.plugins.history.clear()
    const wrapper = mount(BoardRoot, { props: { engine } })

    await wrapper.trigger('keydown', { key: 'x', ctrlKey: true })
    expect(engine.getState().nodes.size).toBe(0)
    expect(engine.plugins.history.getState().undoDepth).toBe(1)

    engine.plugins.history.undo()
    expect(engine.getState().nodes.size).toBe(1)
  })

  it('lets paste own external input and prefer it over the internal buffer', async () => {
    const deserialize = vi.fn((payload: unknown) =>
      (payload as { text?: string }).text === 'external'
        ? [{ type: 'text' as const, text: 'external' }]
        : null,
    )
    const engine = createBoardEngine({ clipboard: { deserialize } })
    engine.createNode({ type: 'text', text: 'buffered' })
    engine.copySelected()
    const wrapper = mount(BoardRoot, { props: { engine } })

    const keydown = new KeyboardEvent('keydown', {
      key: 'v',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    wrapper.element.dispatchEvent(keydown)
    expect(keydown.defaultPrevented).toBe(false)
    expect(engine.getState().nodes.size).toBe(1)

    const paste = dispatchPaste(wrapper.element, 'external')
    await nextTick()

    expect(paste.defaultPrevented).toBe(true)
    expect(deserialize).toHaveBeenCalledOnce()
    expect(
      Array.from(engine.getState().nodes.values()).map((node) => node.text),
    ).toEqual(['buffered', 'external'])
  })

  it('falls back to the internal buffer only after external parsing fails', () => {
    const deserialize = vi.fn(() => null)
    const engine = createBoardEngine({ clipboard: { deserialize } })
    engine.createNode({ type: 'text', text: 'buffered' })
    engine.copySelected()
    const wrapper = mount(BoardRoot, { props: { engine } })

    const paste = dispatchPaste(wrapper.element, 'unsupported')

    expect(deserialize).toHaveBeenCalledOnce()
    expect(paste.defaultPrevented).toBe(true)
    expect(engine.getState().nodes.size).toBe(2)
  })

  it.each([
    ['editable', 'input', {}],
    ['explicitly interactive', 'div', { 'data-board-interactive': 'true' }],
  ])('preserves native paste behavior for %s targets', (_label, tag, attrs) => {
    const deserialize = vi.fn(() => [{ type: 'text' as const }])
    const engine = createBoardEngine({ clipboard: { deserialize } })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })
    const target = document.createElement(tag)
    for (const [name, value] of Object.entries(attrs)) {
      target.setAttribute(name, value)
    }
    wrapper.element.append(target)

    const paste = dispatchPaste(target, 'external')

    expect(paste.defaultPrevented).toBe(false)
    expect(deserialize).not.toHaveBeenCalled()
    expect(engine.getState().nodes.size).toBe(0)
  })

  it('leaves unsuccessful paste data to the consumer when no buffer exists', () => {
    const deserialize = vi.fn(() => null)
    const engine = createBoardEngine({ clipboard: { deserialize } })
    const wrapper = mount(BoardRoot, { props: { engine } })

    const paste = dispatchPaste(wrapper.element, 'unsupported')

    expect(deserialize).toHaveBeenCalledOnce()
    expect(paste.defaultPrevented).toBe(false)
    expect(engine.getState().nodes.size).toBe(0)
  })

  it.each([false, true])(
    'emits exact canvas context coordinates with consumer suppression %s',
    async (suppress) => {
      const engine = createBoardEngine()
      engine.panBy(20, 10)
      engine.zoomAt({ x: 0, y: 0 }, -100)
      const wrapper = mount(BoardRoot, {
        props: {
          engine,
          onCanvasContextmenu(payload: { event: MouseEvent }) {
            if (suppress) payload.event.preventDefault()
          },
        },
      })
      vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
        x: 50,
        y: 40,
        top: 40,
        left: 50,
        right: 850,
        bottom: 640,
        width: 800,
        height: 600,
        toJSON: () => undefined,
      })
      const event = new MouseEvent('contextmenu', {
        clientX: 90,
        clientY: 80,
        bubbles: true,
        cancelable: true,
      })

      wrapper.element.dispatchEvent(event)
      await nextTick()

      const payload = wrapper.emitted('canvasContextmenu')?.[0]?.[0] as {
        event: MouseEvent
        node: null
        screen: { x: number; y: number }
        world: { x: number; y: number }
      }
      expect(payload).toMatchObject({
        event,
        node: null,
        screen: { x: 40, y: 40 },
      })
      expect(payload.world).toEqual(engine.screenToWorld({ x: 40, y: 40 }))
      expect(event.defaultPrevented).toBe(suppress)
    },
  )

  it('includes the owning node in node context-menu payloads', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 10, y: 20 })
    const wrapper = mount(BoardRoot, { props: { engine } })
    const target = wrapper.find(`[data-node-id="${node.id}"]`).element
    const event = new MouseEvent('contextmenu', {
      clientX: 30,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })

    target.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('nodeContextmenu')?.[0]?.[0]).toMatchObject({
      event,
      node: { id: node.id },
      screen: { x: 30, y: 40 },
      world: engine.screenToWorld({ x: 30, y: 40 }),
    })
    expect(event.defaultPrevented).toBe(false)
  })
})
