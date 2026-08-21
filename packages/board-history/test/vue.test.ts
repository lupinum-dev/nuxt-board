/** @vitest-environment jsdom */

import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import { historyPlugin } from '../src'
import { BoardHistoryShortcuts } from '../src/vue'

function createHistoryEngine() {
  const engine = createBoardEngine({ plugins: [historyPlugin()] })
  engine.createNode({ type: 'text', text: 'Undo me' })
  engine.plugins.history.clear()
  engine.createNode({ type: 'text', text: 'Latest' })
  return engine
}

describe('BoardHistoryShortcuts', () => {
  it('rejects a history API owned by another board', () => {
    const first = createHistoryEngine()
    const second = createHistoryEngine()

    expect(() =>
      mount(BoardRoot, {
        props: { engine: first },
        slots: {
          viewport: () =>
            h(BoardHistoryShortcuts, { history: second.plugins.history }),
        },
      }),
    ).toThrow(/must belong to its enclosing BoardRoot/)
  })

  it('undoes only the board that owns the keyboard event', async () => {
    const first = createHistoryEngine()
    const second = createHistoryEngine()
    const Shell = defineComponent(
      () => () =>
        h('div', [
          h(
            BoardRoot,
            { engine: first },
            {
              viewport: () =>
                h(BoardHistoryShortcuts, { history: first.plugins.history }),
            },
          ),
          h(
            BoardRoot,
            { engine: second },
            {
              viewport: () =>
                h(BoardHistoryShortcuts, { history: second.plugins.history }),
            },
          ),
        ]),
    )
    const wrapper = mount(Shell)
    await nextTick()
    const roots = wrapper.findAll('[data-board-root="true"]')

    await roots[0]!.trigger('keydown', { key: 'z', ctrlKey: true })

    expect(first.getState().nodes.size).toBe(1)
    expect(second.getState().nodes.size).toBe(2)

    await roots[0]!.trigger('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(first.getState().nodes.size).toBe(2)
    expect(second.getState().nodes.size).toBe(2)

    await roots[1]!.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(first.getState().nodes.size).toBe(2)
    expect(second.getState().nodes.size).toBe(1)

    await roots[1]!.trigger('keydown', { key: 'y', ctrlKey: true })
    expect(first.getState().nodes.size).toBe(2)
    expect(second.getState().nodes.size).toBe(2)
  })

  it('leaves editable targets and already-owned events untouched', async () => {
    const engine = createHistoryEngine()
    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => [
          h(BoardHistoryShortcuts, { history: engine.plugins.history }),
          h('textarea'),
        ],
      },
    })
    await nextTick()

    const editable = wrapper.find('textarea')
    const editableEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    editable.element.dispatchEvent(editableEvent)
    expect(editableEvent.defaultPrevented).toBe(false)
    expect(engine.getState().nodes.size).toBe(2)

    const owned = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    owned.preventDefault()
    wrapper.element.dispatchEvent(owned)
    expect(engine.getState().nodes.size).toBe(2)
  })
})
