/** @vitest-environment jsdom */

import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { asEdgeId, createBoardEngine } from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'
import { BoardRoot } from '@lupinum/vue-board'
import { connectionsPlugin } from '../src'
import { BoardConnectionLayer } from '../src/vue'
import {
  dispatchPointerEvent,
  installConnectionLayerDomHarness,
  query,
  queryAll,
} from './connection-layer-harness.js'

beforeEach(installConnectionLayerDomHarness)

describe('BoardConnectionLayer', () => {
  it('fails clearly when the connections plugin is missing', () => {
    const engine = createBoardEngine()

    expect(() =>
      mount(BoardRoot, {
        props: { engine },
        slots: { viewport: () => h(BoardConnectionLayer) },
      }),
    ).toThrow(/requires connectionsPlugin\(\)/)
  })

  it('scopes Escape and Delete to the exact owning board', async () => {
    const engines = [0, 1].map(() => {
      const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
      const source = engine.createNode({ text: 'Source' })
      const target = engine.createNode({ x: 240, text: 'Target' })
      engine.plugins.connections.createEdge({
        from: source.id,
        to: target.id,
      })
      return engine
    })
    const wrapper = mount({
      render: () =>
        h(
          'div',
          engines.map((engine) =>
            h(
              BoardRoot,
              { engine },
              { viewport: () => h(BoardConnectionLayer) },
            ),
          ),
        ),
    })
    await nextTick()
    const roots = wrapper.findAll('[data-board-root="true"]')

    for (const root of roots) {
      dispatchPointerEvent(
        root.find('[data-connection-hit="true"]').element,
        'pointerdown',
        { pointerId: 1, button: 0, clientX: 120, clientY: 30 },
      )
    }
    await nextTick()
    expect(roots[0]!.find('[data-connection-toolbar]').exists()).toBe(true)
    expect(roots[1]!.find('[data-connection-toolbar]').exists()).toBe(true)

    await roots[0]!.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(roots[0]!.find('[data-connection-toolbar]').exists()).toBe(false)
    expect(roots[1]!.find('[data-connection-toolbar]').exists()).toBe(true)

    dispatchPointerEvent(
      roots[0]!.find('[data-connection-hit="true"]').element,
      'pointerdown',
      { pointerId: 2, button: 0, clientX: 120, clientY: 30 },
    )
    await nextTick()
    await roots[0]!.trigger('keydown', { key: 'Delete' })
    expect(engines[0]!.plugins.connections.getEdges()).toHaveLength(0)
    expect(engines[1]!.plugins.connections.getEdges()).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not let a nested board clear or delete the outer selection', async () => {
    const createEngine = () => {
      const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
      const source = engine.createNode({ text: 'Source' })
      const target = engine.createNode({ x: 240, text: 'Target' })
      engine.plugins.connections.createEdge({ from: source.id, to: target.id })
      return engine
    }
    const outer = createEngine()
    const inner = createEngine()
    const wrapper = mount(BoardRoot, {
      props: { engine: outer },
      slots: {
        viewport: () => [
          h(BoardConnectionLayer),
          h(
            BoardRoot,
            { engine: inner },
            { viewport: () => h(BoardConnectionLayer) },
          ),
        ],
      },
    })
    await nextTick()
    const roots = wrapper.findAll('[data-board-root="true"]')
    const outerRoot = roots[0]!
    const innerRoot = roots[1]!
    const outerHit = outerRoot
      .findAll('[data-connection-hit="true"]')
      .find((hit) => !innerRoot.element.contains(hit.element))!

    dispatchPointerEvent(outerHit.element, 'pointerdown', {
      pointerId: 1,
      button: 0,
    })
    await nextTick()
    expect(outerRoot.find('[data-connection-toolbar]').exists()).toBe(true)

    dispatchPointerEvent(innerRoot.element, 'pointerdown', {
      pointerId: 2,
      button: 0,
    })
    await innerRoot.trigger('keydown', { key: 'Escape' })
    await innerRoot.trigger('keydown', { key: 'Delete' })
    await nextTick()

    expect(outer.plugins.connections.getEdges()).toHaveLength(1)
    expect(outerRoot.find('[data-connection-toolbar]').exists()).toBe(true)
  })

  it('does not create DOM paths for 10,000 offscreen edges', async () => {
    const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
    const visibleA = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      select: false,
    })
    const visibleB = engine.createNode({
      type: 'text',
      x: 300,
      y: 0,
      select: false,
    })
    const offscreenA = engine.createNode({
      type: 'text',
      x: 100_000,
      y: 100_000,
      select: false,
    })
    const offscreenB = engine.createNode({
      type: 'text',
      x: 100_300,
      y: 100_000,
      select: false,
    })
    engine.batch(() => {
      engine.plugins.connections.createEdge({
        id: asEdgeId('visible'),
        from: visibleA.id,
        to: visibleB.id,
        data: {},
      })
      for (let index = 0; index < 10_000; index += 1) {
        engine.plugins.connections.createEdge({
          id: asEdgeId(`offscreen-${index}`),
          from: offscreenA.id,
          to: offscreenB.id,
          data: {},
        })
      }
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: { viewport: () => h(BoardConnectionLayer) },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()

    expect(queryAll('[data-connection-edge-id]').length).toBeLessThan(10)
    wrapper.unmount()
  }, 15_000)

  it('rerenders path geometry when nodes move', async () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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

  it('renders transient endpoint geometry and restores it on cancellation', async () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
    })
    engine.plugins.connections.createEdge({
      from: source.id,
      to: target.id,
      data: {},
    })
    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: { viewport: () => h(BoardConnectionLayer) },
      attachTo: document.body,
    })
    await nextTick()

    const path = () =>
      query(
        '.board-connection-layer > g > path:not([data-connection-hit])',
      ).getAttribute('d')
    const before = path()
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginResize(target.id, 'se', 1, { x: 400, y: 200 })
    interaction.updatePointer(1, { x: 480, y: 250 })
    await nextTick()
    await nextTick()

    expect(path()).not.toBe(before)
    expect(
      engine.exportDocument().nodes.find((node) => node.id === target.id),
    ).toMatchObject({
      width: 120,
      height: 80,
    })

    interaction.cancelInteraction(1)
    await nextTick()
    await nextTick()
    expect(path()).toBe(before)
    wrapper.unmount()
  })

  it('reduces idle edge chrome at low zoom', async () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const edge = engine.plugins.connections.createEdge({
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

    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      id: edge.id,
      label: undefined,
    })
    expect(document.body.querySelector('[data-connection-label]')).toBeNull()
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    wrapper.unmount()
  })

  it('sets edge direction through the direction menu', async () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const edge = engine.plugins.connections.createEdge({
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

    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
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
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 120,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 160,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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
      plugins: [connectionsPlugin()],
    })
    const source = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 280,
      y: 180,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
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
})
