/** @vitest-environment jsdom */

import { defineComponent, h, markRaw, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'
import BoardRoot from '../src/components/BoardRoot.vue'

function dispatchPointerEvent(
  element: Element,
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

  element.dispatchEvent(event)
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn().mockReturnValue(true),
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
        },
      }
    },
  })
})

describe('BoardRoot', () => {
  it('starts drag and resize only after the pointer clears the movement threshold', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    dispatchPointerEvent(
      wrapper.find(`[data-node-id="${node.id}"]`).element,
      'pointerdown',
      {
        button: 0,
        pointerId: 1,
        clientX: 50,
        clientY: 50,
      },
    )
    expect(engine.getSelection()).toEqual([node.id])
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle',
    })

    dispatchPointerEvent(
      wrapper.find(`[data-node-id="${node.id}"]`).element,
      'pointermove',
      {
        pointerId: 1,
        clientX: 53,
        clientY: 52,
      },
    )
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle',
    })

    dispatchPointerEvent(
      wrapper.find(`[data-node-id="${node.id}"]`).element,
      'pointermove',
      {
        pointerId: 1,
        clientX: 66,
        clientY: 58,
      },
    )
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'dragging-nodes',
    })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 1,
      clientX: 66,
      clientY: 58,
    })

    await nextTick()
    dispatchPointerEvent(
      wrapper.find(`[data-node-id="${node.id}"]`).element,
      'pointerdown',
      {
        button: 0,
        pointerId: 2,
        clientX: 46,
        clientY: 46,
      },
    )
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 2,
      clientX: 46,
      clientY: 46,
    })
    await nextTick()

    dispatchPointerEvent(
      wrapper.find('[data-resize="se"]').element,
      'pointerdown',
      {
        button: 0,
        pointerId: 3,
        clientX: 120,
        clientY: 110,
      },
    )
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'idle',
    })

    dispatchPointerEvent(
      wrapper.find('[data-resize="se"]').element,
      'pointermove',
      {
        pointerId: 3,
        clientX: 132,
        clientY: 122,
      },
    )
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'resizing-node',
      nodeId: node.id,
      handle: 'se',
    })
  })

  it('renders a registry renderer for JSON Canvas node types', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'file', x: 40, y: 40, file: 'Poster' })
    const FileRenderer = markRaw(
      defineComponent({
        props: ['node'],
        setup(props) {
          return () =>
            h('div', { class: 'file-renderer' }, String(props.node.file))
        },
      }),
    )

    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        renderers: {
          file: FileRenderer,
        },
      },
      attachTo: document.body,
    })

    expect(wrapper.find('.file-renderer').text()).toContain('Poster')
  })

  it('renders colored nodes with color variables and applies toolbar color to selection', async () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const first = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      color: '2',
      text: 'Node',
      select: false,
    })
    const second = engine.createNode({
      type: 'group',
      x: 220,
      y: 40,
      width: 160,
      height: 120,
      select: false,
    })
    engine.select([first.id, second.id])

    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    await nextTick()
    const firstNode = wrapper.find(`[data-node-id="${first.id}"]`)
    expect(firstNode.classes()).toContain('is-colored')
    expect(firstNode.attributes('style')).toContain('--board-node-color')

    await wrapper.find('[data-node-color-menu-button="true"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-node-color-option="6"]').trigger('click')
    await nextTick()

    expect(engine.getNode(first.id).color).toBe('6')
    expect(engine.getNode(second.id).color).toBe('6')
  })

  it('draws a box select and updates selection from background drag', async () => {
    const engine = createBoardEngine()
    const first = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 420,
      y: 320,
      width: 80,
      height: 60,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    })
    dispatchPointerEvent(wrapper.element, 'pointermove', {
      pointerId: 7,
      clientX: 180,
      clientY: 140,
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.board-box-select').exists()).toBe(true)

    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 7,
      clientX: 180,
      clientY: 140,
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(engine.getSelection()).toEqual([first.id])
  })

  it('switches the default box-select overlay style by drag direction', async () => {
    const engine = createBoardEngine()
    engine.beginBoxSelect(8, { x: 200, y: 160 })
    engine.updatePointer(8, { x: 0, y: 0 })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })
    await nextTick()

    const overlay = wrapper.find('.board-box-select')
    expect(overlay.exists()).toBe(true)
    expect(overlay.classes()).toContain('board-box-select--crossing')
    expect(overlay.attributes('data-mode')).toBe('crossing')
  })

  it('supports keyboard duplicate and delete shortcuts', async () => {
    const engine = createBoardEngine()
    engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    await wrapper.trigger('keydown', { key: 'a', ctrlKey: true })
    await wrapper.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(engine.getSnapshot().nodes).toHaveLength(2)

    await wrapper.trigger('keydown', { key: 'Delete' })
    expect(engine.getSnapshot().nodes).toHaveLength(1)
  })

  it('duplicates the current selection when alt-dragging past the threshold', async () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    const element = wrapper.find(`[data-node-id="${node.id}"]`).element
    dispatchPointerEvent(element, 'pointerdown', {
      button: 0,
      pointerId: 12,
      altKey: true,
      clientX: 60,
      clientY: 60,
    })
    dispatchPointerEvent(element, 'pointermove', {
      pointerId: 12,
      altKey: true,
      clientX: 84,
      clientY: 84,
    })
    await nextTick()

    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'dragging-nodes',
    })
    expect(engine.getSelection()).toHaveLength(1)
  })

  it('respects guard-blocked drag, duplicate, and create commands without crashing', async () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    const blocked: string[] = []
    engine.addMiddleware((name, _args, next) => {
      if (
        name === 'beginNodeDrag' ||
        name === 'duplicateNodes' ||
        name === 'createNode'
      ) {
        blocked.push(name)
        return
      }
      next()
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    const element = wrapper.find(`[data-node-id="${node.id}"]`).element
    dispatchPointerEvent(element, 'pointerdown', {
      button: 0,
      pointerId: 13,
      clientX: 60,
      clientY: 60,
    })
    dispatchPointerEvent(element, 'pointermove', {
      pointerId: 13,
      clientX: 90,
      clientY: 90,
    })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 13,
      clientX: 90,
      clientY: 90,
    })
    await nextTick()

    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'idle' })
    expect(
      engine.getSnapshot().nodes.find((entry) => entry.id === node.id),
    ).toMatchObject({ x: 40, y: 40 })

    dispatchPointerEvent(element, 'pointerdown', {
      button: 0,
      pointerId: 14,
      altKey: true,
      clientX: 60,
      clientY: 60,
    })
    dispatchPointerEvent(element, 'pointermove', {
      pointerId: 14,
      altKey: true,
      clientX: 90,
      clientY: 90,
    })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 14,
      clientX: 90,
      clientY: 90,
    })
    await nextTick()

    expect(engine.getSnapshot().nodes).toHaveLength(1)

    await wrapper.trigger('dblclick', {
      clientX: 320,
      clientY: 240,
    })

    expect(engine.getSnapshot().nodes).toHaveLength(1)
    expect(blocked).toEqual(['beginNodeDrag', 'duplicateNodes', 'createNode'])
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
          snap: false,
        },
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    expect(engine.getSnapshot().grid).toMatchObject({
      pattern: 'dot',
      size: 24,
      majorEvery: 4,
      snap: false,
    })
    expect(wrapper.find('.board-grid').exists()).toBe(true)
  })

  it('keeps slot snapshot state in sync with undo and redo replays', async () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })
    const node = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      text: 'Node',
    })
    engine.ext.history.clear()

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        default: ({ snapshot }: { snapshot: { nodes: Array<unknown> } }) =>
          h('div', { class: 'snapshot-count' }, String(snapshot.nodes.length)),
      },
      attachTo: document.body,
    })

    await nextTick()
    expect(wrapper.find('.snapshot-count').text()).toBe('1')

    engine.deleteNode(node.id)
    await nextTick()
    expect(wrapper.find('.snapshot-count').text()).toBe('0')

    engine.ext.history.undo()
    await nextTick()
    expect(wrapper.find('.snapshot-count').text()).toBe('1')

    engine.ext.history.redo()
    await nextTick()
    expect(wrapper.find('.snapshot-count').text()).toBe('0')
  })

  it('ignores connection-layer interactive targets for board interactions', () => {
    const engine = createBoardEngine()
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    const interactive = document.createElement('div')
    interactive.dataset.boardInteractive = 'true'
    wrapper.element.appendChild(interactive)

    dispatchPointerEvent(interactive, 'pointerdown', {
      button: 0,
      pointerId: 11,
      clientX: 120,
      clientY: 120,
    })

    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'idle' })
  })
})
