/** @vitest-environment jsdom */

import { defineComponent, h, markRaw, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'
import { historyPlugin } from '@lupinum/board-history'
import BoardRoot from '../src/components/BoardRoot.vue'
import { BoardMinimap } from '../src/minimap'

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
  if (!('pointerType' in event) && init.pointerType !== undefined) {
    Object.defineProperty(event, 'pointerType', {
      configurable: true,
      value: init.pointerType,
    })
  }

  element.dispatchEvent(event)
}

async function flushBoardRootSnapshot(): Promise<void> {
  await Promise.resolve()
  await nextTick()
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
  it('cancels pending pointer projection before unmount completes', async () => {
    let pendingFrame: FrameRequestCallback | null = null
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        pendingFrame = callback
        return 42
      })
    const cancelFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined)
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
      pointerId: 31,
      clientX: 60,
      clientY: 60,
    })
    dispatchPointerEvent(element, 'pointermove', {
      pointerId: 31,
      clientX: 100,
      clientY: 80,
    })
    expect(pendingFrame).not.toBeNull()

    wrapper.unmount()
    expect(cancelFrame).toHaveBeenCalledWith(42)
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
    ;(pendingFrame as FrameRequestCallback | null)?.(performance.now())
    expect(engine.getNode(node.id)).toMatchObject({ x: 40, y: 40 })

    requestFrame.mockRestore()
    cancelFrame.mockRestore()
  })

  it('allows bundled presentation chrome to be disabled directly', () => {
    const wrapper = mount(BoardRoot, {
      props: {
        engine: createBoardEngine(),
        grid: false,
        selectionToolbar: false,
        snapGuides: false,
        boxSelect: false,
      },
    })

    expect(wrapper.find('.board-grid').exists()).toBe(false)
    expect(wrapper.find('.board-selection-toolbar').exists()).toBe(false)
    expect(wrapper.find('.board-snap-guides').exists()).toBe(false)
    expect(wrapper.find('.board-box-select').exists()).toBe(false)
  })

  it('uses granular subscriptions without rebuilding full snapshots', async () => {
    const engine = createBoardEngine()
    const getState = vi.spyOn(engine, 'getState')
    mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    expect(getState).not.toHaveBeenCalled()

    engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    await flushBoardRootSnapshot()

    expect(getState).not.toHaveBeenCalled()
  })

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
    expect(engine.getState().interaction).toMatchObject({
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
    expect(engine.getState().interaction).toMatchObject({
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
    expect(engine.getState().interaction).toMatchObject({
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
    expect(engine.getState().interaction).toMatchObject({
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
    expect(engine.getState().interaction).toMatchObject({
      mode: 'resizing-node',
      nodeId: node.id,
      handle: 'se',
    })
  })

  it('renders transient resize geometry before pointer release', async () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 200,
      height: 100,
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })
    const interaction = getBoardInteractionAdapter(engine)

    interaction.beginResize(node.id, 'se', 1, { x: 240, y: 140 })
    interaction.updatePointer(1, { x: 280, y: 170 })
    await flushBoardRootSnapshot()

    const rendered = wrapper.find(`[data-node-id="${node.id}"]`)
    expect(rendered.attributes('style')).toContain('width: 240px')
    expect(rendered.attributes('style')).toContain('height: 130px')
    expect(engine.exportDocument().nodes[0]).toMatchObject({
      width: 200,
      height: 100,
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

  it('renders content and state updates that do not change node geometry', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 200,
      height: 100,
      text: 'Before',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })

    const rendered = () => wrapper.find(`[data-node-id="${node.id}"]`)
    expect(rendered().text()).toContain('Before')
    expect(rendered().classes()).not.toContain('is-locked')

    engine.updateNode(node.id, { text: 'After', locked: true })
    await flushBoardRootSnapshot()

    expect(rendered().text()).toContain('After')
    expect(rendered().classes()).toContain('is-locked')
  })

  it('renders replacement registry components without node geometry changes', async () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'file', x: 40, y: 40, file: 'Poster' })
    const FirstRenderer = markRaw(
      defineComponent({
        setup: () => () => h('div', { class: 'first-renderer' }, 'First'),
      }),
    )
    const SecondRenderer = markRaw(
      defineComponent({
        setup: () => () => h('div', { class: 'second-renderer' }, 'Second'),
      }),
    )
    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        renderers: { file: FirstRenderer },
      },
      attachTo: document.body,
    })

    expect(wrapper.find('.first-renderer').exists()).toBe(true)

    await wrapper.setProps({ renderers: { file: SecondRenderer } })

    expect(wrapper.find('.first-renderer').exists()).toBe(false)
    expect(wrapper.find('.second-renderer').exists()).toBe(true)
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
    expect(firstNode.attributes('role')).toBe('group')
    expect(firstNode.attributes('aria-label')).toContain('selected')

    const paletteButton = wrapper.find<HTMLButtonElement>(
      '[data-node-color-menu-button="true"]',
    )
    await paletteButton.trigger('click')
    await nextTick()
    expect(paletteButton.attributes('aria-expanded')).toBe('true')
    expect(
      wrapper.find('[data-node-color-menu="true"]').attributes('role'),
    ).toBe('menu')
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio')
    await wrapper.find('[data-node-color-option="6"]').trigger('click')
    await nextTick()

    expect(engine.getNode(first.id).color).toBe('6')
    expect(engine.getNode(second.id).color).toBe('6')
  })

  it('resizes selected nodes from keyboard-operable handles', async () => {
    const engine = createBoardEngine({ grid: { snap: false, size: 20 } })
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, { props: { engine } })
    await nextTick()

    const handle = wrapper.find<HTMLButtonElement>('[data-resize="se"]')
    expect(handle.attributes('aria-label')).toBe('Resize from bottom right')
    await handle.trigger('keydown', { key: 'ArrowRight' })
    await handle.trigger('keydown', { key: 'ArrowDown' })

    expect(engine.getNode(node.id)).toMatchObject({ width: 140, height: 100 })
  })

  it('closes the colour menu with Escape and restores trigger focus', async () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', x: 0, y: 0, text: 'Node' })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      attachTo: document.body,
    })
    const button = wrapper.find<HTMLButtonElement>(
      '[data-node-color-menu-button="true"]',
    )
    await button.trigger('click')
    const menu = wrapper.find('[data-node-color-menu="true"]')

    await menu.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[data-node-color-menu="true"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
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
    getBoardInteractionAdapter(engine).beginBoxSelect(8, { x: 200, y: 160 })
    getBoardInteractionAdapter(engine).updatePointer(8, { x: 0, y: 0 })

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
    expect(engine.getState().nodes.size).toBe(2)

    await wrapper.trigger('keydown', { key: 'Delete' })
    expect(engine.getState().nodes.size).toBe(1)
  })

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

  it('lets the paste event own external and internal paste exactly once', async () => {
    let deserializations = 0
    const engine = createBoardEngine({
      clipboard: {
        deserialize(payload) {
          deserializations += 1
          return (payload as { text?: string }).text === 'external'
            ? [{ type: 'text', text: 'external' }]
            : null
        },
      },
    })
    const buffered = engine.createNode({ type: 'text', text: 'buffered' })
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

    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => 'external', files: [] },
    })
    wrapper.element.dispatchEvent(paste)
    await nextTick()

    expect(paste.defaultPrevented).toBe(true)
    expect(deserializations).toBe(1)
    expect(
      Array.from(engine.getState().nodes.values()).filter(
        (node) => node.text === 'external',
      ),
    ).toHaveLength(1)

    engine.select(buffered.id)
    engine.copySelected()
    const fallback = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(fallback, 'clipboardData', {
      value: { getData: () => 'unknown', files: [] },
    })
    wrapper.element.dispatchEvent(fallback)
    expect(fallback.defaultPrevented).toBe(true)
    expect(engine.getState().nodes.size).toBe(3)
  })

  it.each([
    ['editable', 'input', {}],
    ['explicitly interactive', 'div', { 'data-board-interactive': 'true' }],
  ])(
    'preserves native paste behavior for %s targets',
    async (_label, tag, attributes) => {
      const deserialize = vi.fn(() => [{ type: 'text' as const }])
      const engine = createBoardEngine({ clipboard: { deserialize } })
      const wrapper = mount(BoardRoot, {
        props: { engine },
        attachTo: document.body,
      })
      const target = document.createElement(tag)
      for (const [name, value] of Object.entries(attributes)) {
        target.setAttribute(name, value)
      }
      wrapper.element.append(target)
      const paste = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(paste, 'clipboardData', {
        value: { getData: () => 'external', files: [] },
      })

      target.dispatchEvent(paste)
      await nextTick()

      expect(paste.defaultPrevented).toBe(false)
      expect(deserialize).not.toHaveBeenCalled()
      expect(engine.getState().nodes.size).toBe(0)
    },
  )

  it('leaves unsuccessful paste data to the consumer when no buffer exists', async () => {
    const deserialize = vi.fn(() => null)
    const engine = createBoardEngine({ clipboard: { deserialize } })
    const wrapper = mount(BoardRoot, { props: { engine } })
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => 'unsupported', files: [] },
    })

    wrapper.element.dispatchEvent(paste)
    await nextTick()

    expect(deserialize).toHaveBeenCalledOnce()
    expect(paste.defaultPrevented).toBe(false)
    expect(engine.getState().nodes.size).toBe(0)
  })

  it('emits context information without suppressing the native menu', async () => {
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

    expect(event.defaultPrevented).toBe(false)
    const payload = wrapper.emitted('nodeContextmenu')?.[0]?.[0] as {
      event: MouseEvent
      node: { id: string }
      screen: { x: number; y: number }
    }
    expect(payload.event).toBe(event)
    expect(payload.node.id).toBe(node.id)
    expect(payload.screen).toEqual({ x: 30, y: 40 })
  })

  it('lets a context-menu consumer deliberately suppress the native menu', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 10, y: 20 })
    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        onNodeContextmenu(payload: { event: MouseEvent }) {
          payload.event.preventDefault()
        },
      },
    })
    const target = wrapper.find(`[data-node-id="${node.id}"]`).element
    const event = new MouseEvent('contextmenu', {
      clientX: 30,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })

    target.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
  })

  it('treats an empty-canvas touch as tap or pan without a timer', async () => {
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', text: 'Selected' })
    const wrapper = mount(BoardRoot, { props: { engine } })

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
      button: 0,
    })
    expect(engine.getSelection()).toEqual([node.id])
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
    })
    expect(engine.getSelection()).toEqual([])

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
      button: 0,
    })
    dispatchPointerEvent(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 303,
      clientY: 302,
    })
    expect(engine.getState().camera).toEqual({ x: 0, y: 0, z: 1 })
    dispatchPointerEvent(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 330,
      clientY: 320,
    })
    expect(engine.getState().camera).toMatchObject({ x: 30, y: 20 })
    dispatchPointerEvent(wrapper.element, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 330,
      clientY: 320,
    })
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
    requestFrame.mockRestore()
  })

  it('lets a second finger take over with midpoint pan and pinch zoom', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const wrapper = mount(BoardRoot, { props: { engine } })

    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      button: 0,
    })
    dispatchPointerEvent(wrapper.element, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 100,
      button: 0,
    })
    dispatchPointerEvent(wrapper.element, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 240,
      clientY: 120,
    })

    const camera = engine.getState().camera
    expect(camera.z).toBeGreaterThan(1)
    expect(camera.x).not.toBe(0)
    expect(camera.y).not.toBe(0)

    dispatchPointerEvent(wrapper.element, 'pointercancel', {
      pointerId: 2,
      pointerType: 'touch',
    })
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
  })

  it('keeps node drag and resize available to touch pointers', () => {
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

    dispatchPointerEvent(nodeElement, 'pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40,
      button: 0,
    })
    dispatchPointerEvent(nodeElement, 'pointermove', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 80,
      clientY: 70,
    })
    dispatchPointerEvent(nodeElement, 'pointerup', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 80,
      clientY: 70,
    })
    expect(engine.getNode(node.id)).toMatchObject({ x: 60, y: 50 })

    const handle = wrapper.find('[data-resize="se"]').element
    dispatchPointerEvent(handle, 'pointerdown', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 180,
      clientY: 130,
      button: 0,
    })
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 210,
      clientY: 150,
    })
    dispatchPointerEvent(handle, 'pointerup', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 210,
      clientY: 150,
    })
    expect(engine.getNode(node.id).width).toBeGreaterThan(120)
    expect(engine.getNode(node.id).height).toBeGreaterThan(80)
  })

  it('warns when the engine prop changes after mount', async () => {
    const first = createBoardEngine()
    const second = createBoardEngine()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(BoardRoot, { props: { engine: first } })

    await wrapper.setProps({ engine: second })

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('engine` prop changed'),
    )
  })

  it.each([
    ['file', { type: 'file' as const, file: 'poster.png' }],
    ['link', { type: 'link' as const, url: 'https://example.com' }],
    ['group', { type: 'group' as const }],
  ])('does not expose text editing for %s nodes', async (_type, input) => {
    const errors: unknown[] = []
    const engine = createBoardEngine()
    const node = engine.createNode({ ...input, x: 40, y: 40 })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      global: {
        config: {
          errorHandler: (error) => errors.push(error),
        },
      },
      attachTo: document.body,
    })
    const rendered = wrapper.find(`[data-node-id="${node.id}"]`)

    await rendered.trigger('dblclick', { clientX: 60, clientY: 60 })
    await rendered.trigger('keydown', { key: 'Enter' })
    await wrapper.trigger('keydown', { key: 'Enter' })

    const editButton = wrapper.find('[aria-label="Edit"]')
    expect(editButton.attributes('disabled')).toBeDefined()
    await editButton.trigger('click')

    expect(errors).toEqual([])
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
  })

  it('keeps every built-in text editing entry path working', async () => {
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
    const rendered = wrapper.find(`[data-node-id="${node.id}"]`)

    await rendered.trigger('dblclick', { clientX: 60, clientY: 60 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'editing-text',
    })
    engine.cancelTextEdit()
    await flushBoardRootSnapshot()

    await rendered.trigger('keydown', { key: 'Enter' })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'editing-text',
    })
    engine.cancelTextEdit()
    await flushBoardRootSnapshot()

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'editing-text',
    })
    engine.cancelTextEdit()
    await flushBoardRootSnapshot()

    await wrapper.find('[aria-label="Edit"]').trigger('click')
    expect(engine.getState().interaction).toMatchObject({
      mode: 'editing-text',
    })
  })

  it('leaves keyboard events from embedded controls to the control', async () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      text: 'Node',
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        default: () =>
          h('input', {
            class: 'embedded-input',
            'data-editor': 'true',
          }),
      },
      attachTo: document.body,
    })

    await wrapper.find('.embedded-input').trigger('keydown', {
      key: 'Backspace',
    })

    expect(engine.getNode(node.id)).toBeDefined()
    expect(engine.getSelection()).toEqual([node.id])
  })

  it('does not treat semantic overlay controls as board pointer input', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 40, y: 40, text: 'Node' })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        default: () => h('button', { class: 'overlay-button' }, 'Action'),
      },
      attachTo: document.body,
    })

    dispatchPointerEvent(
      wrapper.find('.overlay-button').element,
      'pointerdown',
      {
        button: 0,
        pointerId: 41,
        clientX: 300,
        clientY: 200,
      },
    )

    expect(engine.getSelection()).toEqual([node.id])
    expect(engine.getState().interaction).toEqual({ mode: 'idle' })
  })

  it('keeps minimap pointer input out of the enclosing board', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 40, y: 40, text: 'Node' })
    const Shell = defineComponent({
      setup: () => () =>
        h(BoardRoot, { engine }, { default: () => h(BoardMinimap) }),
    })
    const wrapper = mount(Shell, { attachTo: document.body })

    dispatchPointerEvent(
      wrapper.find('.board-minimap').element,
      'pointerdown',
      {
        button: 0,
        pointerId: 42,
        clientX: 100,
        clientY: 60,
      },
    )

    expect(engine.getSelection()).toEqual([node.id])
  })

  it('dispatches nested-board events only to the nearest board root', () => {
    const outerEngine = createBoardEngine()
    const innerEngine = createBoardEngine()
    const Shell = defineComponent({
      setup: () => () =>
        h(
          BoardRoot,
          { engine: outerEngine },
          { default: () => h(BoardRoot, { engine: innerEngine }) },
        ),
    })
    const wrapper = mount(Shell, { attachTo: document.body })
    const roots = wrapper.findAll('[data-board-root="true"]')

    roots[1]!.element.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: 320,
        clientY: 240,
      }),
    )

    expect(innerEngine.getState().nodes.size).toBe(1)
    expect(outerEngine.getState().nodes.size).toBe(0)
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

    expect(engine.getState().nodes.size).toBe(2)
    expect(engine.getState().interaction).toMatchObject({
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
    engine.addCommandGuard(({ name }) => {
      if (
        name === 'beginNodeDrag' ||
        name === 'duplicateNodes' ||
        name === 'createNode'
      ) {
        blocked.push(name)
        return 'Board is read-only.'
      }
      return true
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

    expect(engine.getState().interaction).toMatchObject({ mode: 'idle' })
    expect(engine.getState().nodes.get(node.id)).toMatchObject({ x: 40, y: 40 })

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

    expect(engine.getState().nodes.size).toBe(1)

    await wrapper.trigger('dblclick', {
      clientX: 320,
      clientY: 240,
    })

    expect(engine.getState().nodes.size).toBe(1)
    expect(blocked).toEqual(['beginNodeDrag', 'duplicateNodes', 'createNode'])
  })

  it('renders the canonical engine grid with presentation-only overrides', async () => {
    const engine = createBoardEngine({
      grid: { size: 20, majorEvery: 5, snap: true, pattern: 'line' },
    })
    const wrapper = mount(BoardRoot, {
      props: {
        engine,
        grid: {
          visible: true,
          minorOpacity: 0.2,
          fadeEdges: false,
        },
      },
      attachTo: document.body,
    })

    await flushBoardRootSnapshot()

    expect(engine.getState().grid).toMatchObject({
      pattern: 'line',
      size: 20,
      majorEvery: 5,
      snap: true,
    })
    expect(wrapper.find('.board-grid').attributes('style')).toContain(
      '--grid-minor-size: 20px',
    )

    engine.updateGridSettings({ size: 10, snap: false, pattern: 'dot' })
    await flushBoardRootSnapshot()

    const style = wrapper.find('.board-grid').attributes('style')
    expect(style).toContain('--grid-minor-size: 10px')
    expect(style).toContain('radial-gradient')
    expect(engine.getState().grid).toMatchObject({
      pattern: 'dot',
      size: 10,
      snap: false,
    })
  })

  it('keeps slot state in sync with undo and redo replays', async () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })
    const node = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      text: 'Node',
    })
    engine.plugins.history.clear()

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        default: ({
          state,
        }: {
          state: { nodes: ReadonlyMap<string, unknown> }
        }) => h('div', { class: 'state-count' }, String(state.nodes.size)),
      },
      attachTo: document.body,
    })

    await nextTick()
    expect(wrapper.find('.state-count').text()).toBe('1')

    engine.deleteNode(node.id)
    await flushBoardRootSnapshot()
    expect(wrapper.find('.state-count').text()).toBe('0')

    engine.plugins.history.undo()
    await flushBoardRootSnapshot()
    expect(wrapper.find('.state-count').text()).toBe('1')

    engine.plugins.history.redo()
    await flushBoardRootSnapshot()
    expect(wrapper.find('.state-count').text()).toBe('0')
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

    expect(engine.getState().interaction).toMatchObject({ mode: 'idle' })
  })
})
