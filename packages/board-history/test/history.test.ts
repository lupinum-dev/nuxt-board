import { describe, expect, it, vi } from 'vitest'
import { CommandBlockedError, createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('does not record guard-blocked commands', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })
    engine.addMiddleware((name, _args, next) => {
      if (name === 'createNode') return
      next()
    })

    expect(() =>
      engine.createNode({
        type: 'text',
        text: 'blocked',
      }),
    ).toThrow(CommandBlockedError)

    expect(engine.getSnapshot().nodes).toHaveLength(0)
    expect(engine.ext.history.getState()).toEqual({
      undoDepth: 0,
      redoDepth: 0,
      current: null,
    })
  })

  it('undoes and redoes node deletion', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
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
      extensions: [historyPlugin({ debounceMs: 20 })],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
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

  it('undoes and redoes text edits from the built-in editor flow', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
    })
    engine.ext.history.clear()

    engine.beginTextEdit(node.id)
    engine.commitTextEdit(node.id, 'After')

    expect(engine.findNode(node.id)?.text).toBe('After')
    expect(engine.ext.history.canUndo()).toBe(true)

    engine.ext.history.undo()
    expect(engine.findNode(node.id)?.text).toBe('Before')

    engine.ext.history.redo()
    expect(engine.findNode(node.id)?.text).toBe('After')
  })

  it('coalesces interactive resize updates into an undoable change', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      extensions: [historyPlugin({ debounceMs: 0 })],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.ext.history.clear()

    engine.beginResize(node.id, 'se', 1, { x: 120, y: 80 })
    engine.updatePointer(1, { x: 160, y: 110 })
    engine.updatePointer(1, { x: 180, y: 120 })
    engine.endInteraction(1)

    expect(engine.findNode(node.id)).toMatchObject({ width: 180, height: 120 })
    expect(engine.ext.history.getState().undoDepth).toBe(1)

    engine.ext.history.undo()
    expect(engine.findNode(node.id)).toMatchObject({ width: 120, height: 80 })

    engine.ext.history.redo()
    expect(engine.findNode(node.id)).toMatchObject({ width: 180, height: 120 })
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createBoardEngine({
      extensions: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      text: 'Node',
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
      extensions: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      text: 'Node',
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

  it('undoes and redoes group deletion with child connection edges intact', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      extensions: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })
    const group = engine.createNode({
      type: 'group',
      x: 0,
      y: 0,
      width: 300,
      height: 220,
      select: false,
    })
    const child = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 100,
      height: 60,
      parentId: group.id,
      text: 'Child',
      select: false,
    })
    const outside = engine.createNode({
      type: 'text',
      x: 420,
      y: 60,
      width: 100,
      height: 60,
      text: 'Outside',
      select: false,
    })
    const edge = engine.ext.connections.createEdge({
      from: child.id,
      to: outside.id,
      label: 'child edge',
      data: { kind: 'group-delete' },
    })
    engine.ext.history.clear()

    engine.select(group.id)
    engine.deleteSelected()

    expect(engine.hasNode(group.id)).toBe(false)
    expect(engine.hasNode(child.id)).toBe(false)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.undo()
    expect(engine.getNode(child.id).parentId).toBe(group.id)
    expect(engine.ext.connections.getEdge(edge.id)).toMatchObject({
      from: child.id,
      to: outside.id,
      label: 'child edge',
      data: { kind: 'group-delete' },
    })

    engine.ext.history.redo()
    expect(engine.hasNode(group.id)).toBe(false)
    expect(engine.hasNode(child.id)).toBe(false)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)
  })

  it('restores nextZIndex during undo and redo', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })

    engine.ext.history.clear()
    const before = engine.getSnapshot().nextZIndex
    const created = engine.createNode({ type: 'text', x: 0, y: 0, text: '' })

    expect(engine.getSnapshot().nextZIndex).toBe(before + 1)

    engine.ext.history.undo()
    expect(engine.hasNode(created.id)).toBe(false)
    expect(engine.getSnapshot().nextZIndex).toBe(before)

    engine.ext.history.redo()
    expect(engine.hasNode(created.id)).toBe(true)
    expect(engine.getSnapshot().nextZIndex).toBe(before + 1)
  })

  it('does not record board replacement imports in history', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin({ debounceMs: 0 })],
    })
    const existing = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    engine.ext.history.clear()

    engine.importJSON(
      JSON.stringify({
        nodes: [
          {
            id: existing.id,
            type: 'text',
            x: existing.x,
            y: existing.y,
            width: existing.width,
            height: existing.height,
            text: 'Imported',
          },
        ],
        'x-nuxt-board': {
          selection: [existing.id],
        },
      }),
      'replace',
    )

    expect(engine.ext.history.canUndo()).toBe(false)
    expect(engine.getSnapshot().nodes).toHaveLength(1)
    expect(engine.getSnapshot().nodes[0]?.text).toBe('Imported')
  })

  it('undoes and redoes edge reconnect updates', () => {
    const engine = createBoardEngine({
      extensions: [connectionPlugin(), historyPlugin({ debounceMs: 0 })],
    })

    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      text: 'Node',
    })
    const third = engine.createNode({
      type: 'text',
      x: 400,
      y: 0,
      text: 'Node',
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
