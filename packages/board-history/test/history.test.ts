import { describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('undoes and redoes node deletion', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin({ debounceMs: 0 })],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      data: { content: 'Keep me' },
    })
    engine.select(node.id)
    engine.deleteSelected()
    expect(engine.getSnapshot().nodes).toHaveLength(0)

    expect(engine.ext.history.undo).toBeDefined()
    engine.ext.history.undo()
    expect(engine.getSnapshot().nodes).toHaveLength(1)

    engine.ext.history.redo()
    expect(engine.getSnapshot().nodes).toHaveLength(0)
  })

  it('excludes camera commands and groups pointer updates', () => {
    vi.useFakeTimers()
    const engine = createBoardEngine({
      plugins: [historyPlugin({ debounceMs: 20 })],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      data: { content: 'Drag me' },
    })
    engine.ext.history.clear()
    engine.panBy(100, 40)
    expect(engine.ext.history.getState().undoDepth).toBe(0)

    engine.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 40, y: 0 })
    engine.updatePointer(1, { x: 80, y: 0 })
    engine.endInteraction(1)

    vi.advanceTimersByTime(25)
    expect(engine.ext.history.canUndo()).toBe(true)
    engine.ext.history.undo()
    expect(
      engine.getSnapshot().nodes.find((entry) => entry.id === node.id),
    ).toMatchObject({ x: 0, y: 0 })
    vi.useRealTimers()
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      data: { content: 'A' },
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      data: { content: 'B' },
    })
    engine.ext.history.clear()

    const edge = engine.ext.connections.createEdge({
      from: first.id,
      to: second.id,
      label: 'A->B',
      fromEnd: 'arrow',
      color: '#111827',
      data: {},
    })
    expect(edge).toBeDefined()

    engine.deleteNode(first.id)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.undo()
    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.ext.connections.getEdges()).toHaveLength(1)
    expect(engine.ext.connections.getEdges()[0]).toMatchObject({
      label: 'A->B',
      fromEnd: 'arrow',
      color: '#111827',
    })

    engine.ext.history.redo()
    expect(engine.ext.connections.getEdges()).toHaveLength(0)
  })

  it('restores dependent nodes before replaying connection creations on undo', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      data: { content: 'A' },
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      data: { content: 'B' },
    })
    engine.ext.connections.createEdge({
      from: first.id,
      to: second.id,
      data: {},
    })
    engine.ext.history.clear()

    engine.deleteNode(first.id)

    const endpointChecks: boolean[] = []
    const off = engine.on('edge:created', (edge) => {
      endpointChecks.push(engine.hasNode(edge.from) && engine.hasNode(edge.to))
    })
    engine.ext.history.undo()
    off()

    expect(endpointChecks).toEqual([true])
  })

  it('restores nextZIndex during undo and redo', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin({ debounceMs: 0 })],
    })

    engine.ext.history.clear()
    const before = engine.getSnapshot().nextZIndex
    const created = engine.createNode({ type: 'text', x: 0, y: 0, data: {} })

    expect(engine.getSnapshot().nextZIndex).toBe(before + 1)

    engine.ext.history.undo()
    expect(engine.hasNode(created.id)).toBe(false)
    expect(engine.getSnapshot().nextZIndex).toBe(before)

    engine.ext.history.redo()
    expect(engine.hasNode(created.id)).toBe(true)
    expect(engine.getSnapshot().nextZIndex).toBe(before + 1)
  })

  it('undoes and redoes edge reconnect updates', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      data: { content: 'A' },
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      data: { content: 'B' },
    })
    const third = engine.createNode({
      type: 'text',
      x: 400,
      y: 0,
      data: { content: 'C' },
    })
    const edge = engine.ext.connections.createEdge({
      from: first.id,
      to: second.id,
      fromAnchor: { side: 'right', offset: 0.3 },
      toAnchor: { side: 'left', offset: 0.6 },
      label: 'A->B',
      data: {},
    })

    engine.ext.history.clear()
    engine.ext.connections.updateEdge(edge.id, {
      to: third.id,
      toAnchor: undefined,
    })

    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      to: third.id,
      fromAnchor: { side: 'right', offset: 0.3 },
      toAnchor: undefined,
    })

    engine.ext.history.undo()
    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      to: second.id,
      toAnchor: { side: 'left', offset: 0.6 },
    })

    engine.ext.history.redo()
    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      to: third.id,
      toAnchor: undefined,
    })
  })
})
