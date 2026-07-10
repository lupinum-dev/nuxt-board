import { describe, expect, it } from 'vitest'
import { CommandBlockedError, createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('does not record guard-blocked commands', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })
    engine.addCommandGuard(({ name }) =>
      name === 'createNode' ? 'Board is read-only.' : true,
    )

    expect(() =>
      engine.createNode({
        type: 'text',
        text: 'blocked',
      }),
    ).toThrow(CommandBlockedError)

    expect(engine.getState().nodes.size).toBe(0)
    expect(engine.plugins.history.getState()).toEqual({
      undoDepth: 0,
      redoDepth: 0,
      current: null,
    })
  })

  it('undoes and redoes node deletion', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
    })
    engine.select(node.id)
    engine.deleteSelected()
    expect(engine.getState().nodes.size).toBe(0)

    expect(engine.plugins.history.undo).toBeDefined()
    engine.plugins.history.undo()
    expect(engine.getState().nodes.size).toBe(1)

    engine.plugins.history.redo()
    expect(engine.getState().nodes.size).toBe(0)
  })

  it('emits public event payloads without replay actions', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })
    const payloads: unknown[] = []

    engine.on('history:push', (entry) => payloads.push(entry))
    engine.on('history:undo', (entry) => payloads.push(entry))
    engine.on('history:redo', (entry) => payloads.push(entry))

    engine.createNode({
      type: 'text',
      text: 'Event payload',
    })
    engine.plugins.history.undo()
    engine.plugins.history.redo()

    expect(payloads).toHaveLength(3)
    for (const payload of payloads) {
      expect(payload).toMatchObject({
        label: expect.any(String),
        timestamp: expect.any(Number),
      })
      expect(Object.hasOwn(payload as object, 'actions')).toBe(false)
    }
  })

  it('excludes camera commands and records an interaction commit', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })

    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    engine.plugins.history.clear()
    engine.panBy(100, 40)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)

    engine.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 40, y: 0 })
    engine.updatePointer(1, { x: 80, y: 0 })
    engine.endInteraction(1)

    expect(engine.plugins.history.canUndo()).toBe(true)
    engine.plugins.history.undo()
    expect(engine.getState().nodes.get(node.id)).toMatchObject({ x: 0, y: 0 })
  })

  it('records commits synchronously without pending timers', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })

    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Pending',
    })

    expect(engine.plugins.history.getState()).toEqual({
      undoDepth: 1,
      redoDepth: 0,
      current: 'createNode',
    })
    expect(engine.plugins.history.canUndo()).toBe(true)
    expect(engine.plugins.history.canRedo()).toBe(false)
    expect(engine.plugins.history.getState()).toEqual({
      undoDepth: 1,
      redoDepth: 0,
      current: 'createNode',
    })
  })

  it('undoes and redoes text edits from the built-in editor flow', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
    })
    engine.plugins.history.clear()

    engine.beginTextEdit(node.id)
    engine.commitTextEdit(node.id, 'After')

    expect(engine.findNode(node.id)?.text).toBe('After')
    expect(engine.plugins.history.canUndo()).toBe(true)

    engine.plugins.history.undo()
    expect(engine.findNode(node.id)?.text).toBe('Before')

    engine.plugins.history.redo()
    expect(engine.findNode(node.id)?.text).toBe('After')
  })

  it('coalesces interactive resize updates into an undoable change', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [historyPlugin()],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    engine.plugins.history.clear()

    engine.beginResize(node.id, 'se', 1, { x: 120, y: 80 })
    engine.updatePointer(1, { x: 160, y: 110 })
    engine.updatePointer(1, { x: 180, y: 120 })
    engine.endInteraction(1)

    expect(engine.findNode(node.id)).toMatchObject({ width: 180, height: 120 })
    expect(engine.plugins.history.getState().undoDepth).toBe(1)

    engine.plugins.history.undo()
    expect(engine.findNode(node.id)).toMatchObject({ width: 120, height: 80 })

    engine.plugins.history.redo()
    expect(engine.findNode(node.id)).toMatchObject({ width: 180, height: 120 })
  })

  it('undoes and redoes multi-node drag updates', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [historyPlugin()],
    })
    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'First',
    })
    const second = engine.createNode({
      type: 'text',
      x: 100,
      y: 50,
      text: 'Second',
    })
    engine.plugins.history.clear()

    engine.select([first.id, second.id])
    engine.beginNodeDrag(first.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 20 })
    engine.endInteraction(1)

    expect(engine.findNode(first.id)).toMatchObject({ x: 50, y: 20 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 150, y: 70 })
    expect(engine.plugins.history.getState().undoDepth).toBe(1)

    engine.plugins.history.undo()
    expect(engine.findNode(first.id)).toMatchObject({ x: 0, y: 0 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 100, y: 50 })

    engine.plugins.history.redo()
    expect(engine.findNode(first.id)).toMatchObject({ x: 50, y: 20 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 150, y: 70 })
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), historyPlugin()],
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
    engine.plugins.history.clear()

    const edge = engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      label: 'A->B',
      fromEnd: 'arrow',
      color: '#111827',
      data: {},
    })
    expect(edge).toBeDefined()

    engine.deleteNode(first.id)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)

    engine.plugins.history.undo()
    expect(engine.getState().nodes.size).toBe(2)
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      label: 'A->B',
      fromEnd: 'arrow',
      color: '#111827',
    })

    engine.plugins.history.redo()
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
  })

  it('restores dependent nodes before replaying connection creations on undo', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), historyPlugin()],
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
    engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      data: {},
    })
    engine.plugins.history.clear()

    engine.deleteNode(first.id)

    const endpointChecks: boolean[] = []
    const off = engine.on('edge:created', (edge) => {
      endpointChecks.push(engine.hasNode(edge.from) && engine.hasNode(edge.to))
    })
    engine.plugins.history.undo()
    off()

    expect(endpointChecks).toEqual([true])
  })

  it('undoes and redoes group deletion with child connection edges intact', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [connectionsPlugin(), historyPlugin()],
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
    const edge = engine.plugins.connections.createEdge({
      from: child.id,
      to: outside.id,
      label: 'child edge',
      data: { kind: 'group-delete' },
    })
    engine.plugins.history.clear()

    engine.select(group.id)
    engine.deleteSelected()

    expect(engine.hasNode(group.id)).toBe(false)
    expect(engine.hasNode(child.id)).toBe(false)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)

    engine.plugins.history.undo()
    expect(engine.getNode(child.id).parentId).toBe(group.id)
    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      from: child.id,
      to: outside.id,
      label: 'child edge',
      data: { kind: 'group-delete' },
    })

    engine.plugins.history.redo()
    expect(engine.hasNode(group.id)).toBe(false)
    expect(engine.hasNode(child.id)).toBe(false)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
  })

  it('restores nextZIndex during undo and redo', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })

    engine.plugins.history.clear()
    const nextZIndex = () =>
      engine.exportDocument()['x-vue-board']?.nextZIndex ?? 1
    const before = nextZIndex()
    const created = engine.createNode({ type: 'text', x: 0, y: 0, text: '' })

    expect(nextZIndex()).toBe(before + 1)

    engine.plugins.history.undo()
    expect(engine.hasNode(created.id)).toBe(false)
    expect(nextZIndex()).toBe(before)

    engine.plugins.history.redo()
    expect(engine.hasNode(created.id)).toBe(true)
    expect(nextZIndex()).toBe(before + 1)
  })

  it('does not record board replacement imports in history', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin()],
    })
    const existing = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    engine.plugins.history.clear()

    engine.loadDocument(
      {
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
        'x-vue-board': {
          selection: [existing.id],
        },
      },
      { mode: 'replace' },
    )

    expect(engine.plugins.history.canUndo()).toBe(false)
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.getState().nodes.get(existing.id)?.text).toBe('Imported')
  })

  it('undoes and redoes edge reconnect updates', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), historyPlugin()],
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
    const edge = engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      fromAnchor: { side: 'right', offset: 0.3 },
      toAnchor: { side: 'left', offset: 0.6 },
      label: 'A->B',
      data: {},
    })

    engine.plugins.history.clear()
    engine.plugins.connections.updateEdge(edge.id, {
      to: third.id,
      toAnchor: undefined,
    })

    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      to: third.id,
      fromAnchor: { side: 'right', offset: 0.3 },
      toAnchor: undefined,
    })

    engine.plugins.history.undo()
    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      to: second.id,
      toAnchor: { side: 'left', offset: 0.6 },
    })

    engine.plugins.history.redo()
    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      to: third.id,
      toAnchor: undefined,
    })
  })

  it('undoes and redoes mixed node and connection changes captured in one batch', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), historyPlugin()],
    })
    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
    })
    const second = engine.createNode({
      type: 'text',
      x: 200,
      y: 0,
      text: 'Target',
    })
    engine.plugins.history.clear()

    engine.batch(() => {
      engine.updateNode(first.id, { text: 'After' })
      engine.plugins.connections.createEdge({
        from: first.id,
        to: second.id,
        label: 'batched',
        data: {},
      })
    })

    expect(engine.getNode(first.id).text).toBe('After')
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)

    engine.plugins.history.undo()
    expect(engine.getNode(first.id).text).toBe('Before')
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)

    engine.plugins.history.redo()
    expect(engine.getNode(first.id).text).toBe('After')
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      from: first.id,
      to: second.id,
      label: 'batched',
    })
  })
})
