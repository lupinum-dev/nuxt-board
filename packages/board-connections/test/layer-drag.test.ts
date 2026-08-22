/** @vitest-environment jsdom */

import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
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

describe('BoardConnectionLayer drag interactions', () => {
  it('reconnects a dragged handle to another node and stays idle in the board engine', async () => {
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
    const mid = engine.createNode({
      type: 'text',
      x: 260,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const target = engine.createNode({
      type: 'text',
      x: 500,
      y: 20,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const edge = engine.plugins.connections.createEdge({
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
      clientX: 500,
      clientY: 40,
    })
    await nextTick()
    await nextTick()
    expect(queryAll('.board-connection-layer rect')).not.toHaveLength(0)

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 2,
      clientX: 500,
      clientY: 40,
    })
    await nextTick()
    await nextTick()

    expect(engine.getState().interaction).toMatchObject({ mode: 'idle' })
    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: { side: 'left', offset: 0.25 },
    })
    wrapper.unmount()
  })

  it('cancels reconnect when the dragged endpoint is dropped off-node', async () => {
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

    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      from: source.id,
      to: target.id,
    })
    wrapper.unmount()
  })

  it('reveals a node-side create handle and creates a new edge to another node', async () => {
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
      x: 320,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
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

    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      from: source.id,
      to: target.id,
    })
    expect(engine.plugins.connections.getEdges()[0]?.fromAnchor).toBeUndefined()
    expect(engine.plugins.connections.getEdges()[0]?.toAnchor).toBeUndefined()
    wrapper.unmount()
  })

  it('can lock UI-created edges to manual endpoint anchors', async () => {
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
      x: 320,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
    })

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () => h(BoardConnectionLayer, { endpointMode: 'manual' }),
      },
      attachTo: document.body,
    })

    await nextTick()
    const root = query('.board-root')
    dispatchPointerEvent(root, 'pointermove', {
      pointerId: 11,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()

    const createHandle = query(
      `[data-connection-node-id="${source.id}"][data-connection-side="right"]`,
    )
    dispatchPointerEvent(createHandle, 'pointerdown', {
      pointerId: 11,
      button: 0,
      clientX: 160,
      clientY: 80,
    })
    await nextTick()
    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 11,
      clientX: 320,
      clientY: 80,
    })
    await nextTick()
    await nextTick()
    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 11,
      clientX: 320,
      clientY: 80,
    })
    await nextTick()
    await nextTick()

    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      from: source.id,
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.5 },
      toAnchor: { side: 'left', offset: 0.5 },
    })
    wrapper.unmount()
  })

  it('resets manual endpoint anchors back to auto from the edge toolbar', async () => {
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
      x: 320,
      y: 40,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const edge = engine.plugins.connections.createEdge({
      from: source.id,
      to: target.id,
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
    dispatchPointerEvent(hit, 'pointerdown', {
      pointerId: 12,
      button: 0,
      clientX: 240,
      clientY: 80,
    })
    await nextTick()

    const resetSource = query('[data-connection-reset-source-anchor]')
    resetSource.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(
      engine.plugins.connections.getEdge(edge.id)?.fromAnchor,
    ).toBeUndefined()
    expect(engine.plugins.connections.getEdge(edge.id)?.toAnchor).toEqual({
      side: 'left',
      offset: 0.75,
    })

    const resetAll = query('[data-connection-reset-target-anchor]')
    resetAll.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(
      engine.plugins.connections.getEdge(edge.id)?.fromAnchor,
    ).toBeUndefined()
    expect(
      engine.plugins.connections.getEdge(edge.id)?.toAnchor,
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('does not create a node when a create drag is dropped on empty space by default', async () => {
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

    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expect(engine.getState().interaction).toMatchObject({
      mode: 'idle',
    })
    wrapper.unmount()
  })

  it('uses the opt-in empty-drop callback to create and connect a node', async () => {
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
    const createNodeForConnection = vi.fn((context) =>
      engine.createNode({
        type: 'text',
        x: context.pointerWorld.x,
        y: context.pointerWorld.y,
        width: 120,
        height: 80,
        text: 'Created',
      }),
    )

    const wrapper = mount(BoardRoot, {
      props: { engine },
      slots: {
        viewport: () =>
          h(BoardConnectionLayer, {
            createNodeForConnection,
          }),
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

    expect(createNodeForConnection).toHaveBeenCalledWith({
      sourceNodeId: source.id,
      sourceSide: 'right',
      pointerWorld: { x: 520, y: 220 },
      candidateAnchor: null,
    })
    expect(engine.getState().nodes.size).toBe(2)
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      from: source.id,
    })
    expect(engine.plugins.connections.getEdges()[0]?.fromAnchor).toBeUndefined()
    expect(engine.plugins.connections.getEdges()[0]?.toAnchor).toBeUndefined()
    wrapper.unmount()
  })
})
