import { describe, expect, it } from 'vitest'
import { CommandBlockedError, createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('does not record guard-blocked commands', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin()],
    })
    engine.addCommandGuard((name, _args, next) => {
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
      extensions: [historyPlugin()],
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

  it('emits public event payloads without replay actions', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin()],
    })
    const payloads: unknown[] = []

    engine.on('history:push', (entry) => payloads.push(entry))
    engine.on('history:undo', (entry) => payloads.push(entry))
    engine.on('history:redo', (entry) => payloads.push(entry))

    engine.createNode({
      type: 'text',
      text: 'Event payload',
    })
    engine.ext.history.undo()
    engine.ext.history.redo()

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
      extensions: [historyPlugin()],
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

    expect(engine.ext.history.canUndo()).toBe(true)
    engine.ext.history.undo()
    expect(
      engine.getSnapshot().nodes.find((entry) => entry.id === node.id),
    ).toMatchObject({ x: 0, y: 0 })
  })

  it('records commits synchronously without pending timers', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin()],
    })

    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Pending',
    })

    expect(engine.ext.history.getState()).toEqual({
      undoDepth: 1,
      redoDepth: 0,
      current: 'createNode',
    })
    expect(engine.ext.history.canUndo()).toBe(true)
    expect(engine.ext.history.canRedo()).toBe(false)
    expect(engine.ext.history.getState()).toEqual({
      undoDepth: 1,
      redoDepth: 0,
      current: 'createNode',
    })
  })

  it('undoes and redoes text edits from the built-in editor flow', () => {
    const engine = createBoardEngine({
      extensions: [historyPlugin()],
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
      extensions: [historyPlugin()],
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

  it('undoes and redoes multi-node drag updates', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      extensions: [historyPlugin()],
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
    engine.ext.history.clear()

    engine.select([first.id, second.id])
    engine.beginNodeDrag(first.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 20 })
    engine.endInteraction(1)

    expect(engine.findNode(first.id)).toMatchObject({ x: 50, y: 20 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 150, y: 70 })
    expect(engine.ext.history.getState().undoDepth).toBe(1)

    engine.ext.history.undo()
    expect(engine.findNode(first.id)).toMatchObject({ x: 0, y: 0 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 100, y: 50 })

    engine.ext.history.redo()
    expect(engine.findNode(first.id)).toMatchObject({ x: 50, y: 20 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 150, y: 70 })
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createBoardEngine({
      extensions: [connectionPlugin(), historyPlugin()],
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
      extensions: [connectionPlugin(), historyPlugin()],
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
      extensions: [connectionPlugin(), historyPlugin()],
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
      extensions: [historyPlugin()],
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
      extensions: [historyPlugin()],
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
        'x-vue-board': {
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
      extensions: [connectionPlugin(), historyPlugin()],
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

  it('undoes and redoes mixed node and connection changes captured in one batch', () => {
    const engine = createBoardEngine({
      extensions: [connectionPlugin(), historyPlugin()],
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
    engine.ext.history.clear()

    engine.batch(() => {
      engine.updateNode(first.id, { text: 'After' })
      engine.ext.connections.createEdge({
        from: first.id,
        to: second.id,
        label: 'batched',
        data: {},
      })
    })

    expect(engine.getNode(first.id).text).toBe('After')
    expect(engine.ext.connections.getEdges()).toHaveLength(1)

    engine.ext.history.undo()
    expect(engine.getNode(first.id).text).toBe('Before')
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.redo()
    expect(engine.getNode(first.id).text).toBe('After')
    expect(engine.ext.connections.getEdges()).toHaveLength(1)
    expect(engine.ext.connections.getEdges()[0]).toMatchObject({
      from: first.id,
      to: second.id,
      label: 'batched',
    })
  })
})
