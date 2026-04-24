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

function query(selector: string): Element {
  const element = document.body.querySelector(selector)
  if (!element) {
    throw new Error(`Missing element for selector: ${selector}`)
  }
  return element
}

function queryAll(selector: string): Element[] {
  return Array.from(document.body.querySelectorAll(selector))
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

describe('BoardConnectionLayer', () => {
  it('rerenders path geometry when nodes move', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      label: 'sync',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const before = query(
      '.board-connection-layer > g > path:not([data-connection-hit])',
    ).getAttribute('d')
    engine.updateNode(target.id, { x: 420, y: 40 })
    await nextTick()
    await nextTick()
    const after = query(
      '.board-connection-layer > g > path:not([data-connection-hit])',
    ).getAttribute('d')

    expect(before).not.toBe(after)
    wrapper.unmount()
  })

  it('reduces idle edge chrome at low zoom', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      label: 'sync',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const path = query(
      '.board-connection-layer > g > path:not([data-connection-hit])',
    )
    expect(
      document.body.querySelector('[data-connection-label]'),
    ).not.toBeNull()
    expect(path.getAttribute('opacity')).toBe('0.7')
    expect(Number(path.getAttribute('stroke-width'))).toBeCloseTo(1.85, 6)

    await engine.zoomTo(0.45)
    await nextTick()
    await nextTick()

    const lowZoomLabel = document.body.querySelector<HTMLElement>(
      '[data-connection-label]',
    )
    expect(lowZoomLabel).not.toBeNull()
    expect(lowZoomLabel?.style.background).toBe('transparent')
    expect(lowZoomLabel?.style.boxShadow).toBe('none')
    expect(path.getAttribute('opacity')).toBe('0.24')
    expect(Number(path.getAttribute('stroke-width'))).toBeCloseTo(1.15, 6)
    wrapper.unmount()
  })

  it('removes a selected edge label without deleting the edge', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    const edge = engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      label: 'sync',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    dispatchPointerEvent(query('[data-connection-hit="true"]'), 'pointerdown', {
      pointerId: 8,
      button: 0,
      clientX: 140,
      clientY: 60,
    })
    await nextTick()
    ;(query('[data-connection-remove-label]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()

    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      id: edge.id,
      label: undefined,
    })
    expect(document.body.querySelector('[data-connection-label]')).toBeNull()
    expect(engine.ext.connections.getEdges()).toHaveLength(1)
    wrapper.unmount()
  })

  it('sets edge direction through the direction menu', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    const edge = engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      fromEnd: 'none',
      toEnd: 'arrow',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    dispatchPointerEvent(query('[data-connection-hit="true"]'), 'pointerdown', {
      pointerId: 9,
      button: 0,
      clientX: 140,
      clientY: 60,
    })
    await nextTick()
    ;(
      query('[data-connection-direction-menu-button]') as HTMLButtonElement
    ).click()
    await nextTick()
    expect(queryAll('[data-connection-direction-option]')).toHaveLength(3)
    ;(
      query('[data-connection-direction-option="both"]') as HTMLButtonElement
    ).click()
    await nextTick()

    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      fromEnd: 'arrow',
      toEnd: 'arrow',
    })
    expect(
      document.body.querySelector('[data-connection-direction-menu]'),
    ).toBeNull()
    wrapper.unmount()
  })

  it('scales arrowhead markers with the zoom level', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      toEnd: 'arrow',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()

    const marker = query('.board-connection-layer defs marker')
    expect(marker.getAttribute('markerUnits')).toBe('userSpaceOnUse')
    expect(Number(marker.getAttribute('markerWidth'))).toBeCloseTo(16, 6)
    expect(Number(marker.getAttribute('markerHeight'))).toBeCloseTo(16, 6)

    await engine.zoomTo(0.5)
    await nextTick()
    await nextTick()

    expect(Number(marker.getAttribute('markerWidth'))).toBeCloseTo(
      (16 * Math.sqrt(0.5)) / 0.5,
      6,
    )
    expect(Number(marker.getAttribute('markerHeight'))).toBeCloseTo(
      (16 * Math.sqrt(0.5)) / 0.5,
      6,
    )

    await engine.zoomTo(2)
    await nextTick()
    await nextTick()

    expect(Number(marker.getAttribute('markerWidth'))).toBeCloseTo(11, 6)
    expect(Number(marker.getAttribute('markerHeight'))).toBeCloseTo(11, 6)
    wrapper.unmount()
  })

  it('exposes resolved endpoints and route metadata to the edge slot', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 160,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      toEnd: 'arrow',
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () =>
          h(BoardConnectionLayer, null, {
            edge: ({
              source,
              target,
              route,
            }: {
              source: { side: string }
              target: { side: string }
              route: { routing: string; path: string }
            }) =>
              h(
                'div',
                { class: 'edge-slot' },
                `${source.side}|${target.side}|${route.routing}|${route.path.includes('C')}`,
              ),
          }),
      },
      attachTo: document.body,
    })

    await nextTick()
    expect(wrapper.find('.edge-slot').text()).toMatch(
      /right\|left\|bezier\|true/,
    )
    wrapper.unmount()
  })

  it('reveals endpoint handles on hover and selects edges on pointerdown', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    expect(queryAll('[data-connection-handle="from"]')).toHaveLength(0)

    const hit = query('[data-connection-hit="true"]')
    dispatchPointerEvent(hit, 'pointermove', {
      pointerId: 1,
      clientX: 140,
      clientY: 60,
    })
    await nextTick()
    expect(queryAll('[data-connection-handle="from"]')).toHaveLength(1)
    expect(queryAll('[data-connection-handle="to"]')).toHaveLength(1)

    dispatchPointerEvent(hit, 'pointerdown', {
      pointerId: 1,
      button: 0,
      clientX: 140,
      clientY: 60,
    })
    await nextTick()
    expect(queryAll('[data-connection-handle="from"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders auto endpoint handles at the side midpoint', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 180,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const hit = query('[data-connection-hit="true"]')
    dispatchPointerEvent(hit, 'pointermove', {
      pointerId: 4,
      clientX: 180,
      clientY: 120,
    })
    await nextTick()

    const fromCircles = queryAll('[data-connection-handle="from"] circle')
    const toCircles = queryAll('[data-connection-handle="to"] circle')
    expect(fromCircles).toHaveLength(2)
    expect(toCircles).toHaveLength(2)
    expect(fromCircles[1]?.getAttribute('cx')).toBe('160')
    expect(fromCircles[1]?.getAttribute('cy')).toBe('80')
    expect(toCircles[1]?.getAttribute('cx')).toBe('280')
    expect(toCircles[1]?.getAttribute('cy')).toBe('220')
    wrapper.unmount()
  })

  it('reconnects a dragged handle to another node and stays idle in the board engine', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const mid = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 500,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'C' },
    })
    const edge = engine.ext.connections.createEdge({
      from: source.id,
      to: mid.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: { side: 'left', offset: 0.75 },
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const hit = query('[data-connection-hit="true"]')
    dispatchPointerEvent(hit, 'pointermove', {
      pointerId: 2,
      clientX: 150,
      clientY: 60,
    })
    await nextTick()

    const handle = query('[data-connection-handle="to"]')
    dispatchPointerEvent(handle, 'pointerdown', {
      pointerId: 2,
      button: 0,
      clientX: 260,
      clientY: 60,
    })
    await nextTick()

    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 2,
      clientX: 560,
      clientY: 60,
    })
    await nextTick()
    await nextTick()
    expect(queryAll('.board-connection-layer rect')).not.toHaveLength(0)

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 2,
      clientX: 560,
      clientY: 60,
    })
    await nextTick()
    await nextTick()

    expect(engine.getSnapshot().interaction).toMatchObject({ mode: 'idle' })
    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: undefined,
    })
    wrapper.unmount()
  })

  it('cancels reconnect when the dragged endpoint is dropped off-node', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })
    const edge = engine.ext.connections.createEdge({
      from: source.id,
      to: target.id,
      data: {},
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const hit = query('[data-connection-hit="true"]')
    dispatchPointerEvent(hit, 'pointermove', {
      pointerId: 3,
      clientX: 150,
      clientY: 60,
    })
    await nextTick()

    const handle = query('[data-connection-handle="from"]')
    dispatchPointerEvent(handle, 'pointerdown', {
      pointerId: 3,
      button: 0,
      clientX: 140,
      clientY: 60,
    })
    await nextTick()

    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 3,
      clientX: 740,
      clientY: 440,
    })
    await nextTick()
    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 3,
      clientX: 740,
      clientY: 440,
    })
    await nextTick()
    await nextTick()

    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      from: source.id,
      to: target.id,
    })
    wrapper.unmount()
  })

  it('reveals a node-side create handle and creates a new edge to another node', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })
    const target = engine.createNode({
      type: 'text',
      x: 320,
      y: 40,
      width: 120,
      height: 80,
      data: { content: 'B' },
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const root = query('.board-root')
    dispatchPointerEvent(root, 'pointermove', {
      pointerId: 9,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()

    const createHandle = query(
      `[data-connection-node-id="${source.id}"][data-connection-side="right"]`,
    )
    expect(queryAll('[data-connection-create-handle="true"]')).toHaveLength(4)

    dispatchPointerEvent(createHandle, 'pointerdown', {
      pointerId: 9,
      button: 0,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()
    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 9,
      clientX: 340,
      clientY: 80,
    })
    await nextTick()
    await nextTick()
    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 9,
      clientX: 340,
      clientY: 80,
    })
    await nextTick()
    await nextTick()

    expect(engine.ext.connections.getEdges()).toHaveLength(1)
    expect(engine.ext.connections.getEdges()[0]).toMatchObject({
      from: source.id,
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.5 },
    })
    wrapper.unmount()
  })

  it('creates a new text node when a create drag is dropped on empty space', async () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      data: { content: 'A' },
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer),
      },
      attachTo: document.body,
    })

    await nextTick()
    const root = query('.board-root')
    dispatchPointerEvent(root, 'pointermove', {
      pointerId: 10,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()

    const createHandle = query(
      `[data-connection-node-id="${source.id}"][data-connection-side="right"]`,
    )
    dispatchPointerEvent(createHandle, 'pointerdown', {
      pointerId: 10,
      button: 0,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()
    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 10,
      clientX: 520,
      clientY: 220,
    })
    await nextTick()
    await nextTick()
    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 10,
      clientX: 520,
      clientY: 220,
    })
    await nextTick()
    await nextTick()

    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.ext.connections.getEdges()).toHaveLength(1)
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'editing-text',
    })
    wrapper.unmount()
  })
})
