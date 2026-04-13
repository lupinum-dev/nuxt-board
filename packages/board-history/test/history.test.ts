import { describe, expect, it, vi } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('undoes and redoes node deletion', () => {
    const engine = createBoardEngine({
      plugins: [historyPlugin({ debounceMs: 0 })]
    })

    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Keep me' } })
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
      plugins: [historyPlugin({ debounceMs: 20 })]
    })

    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Drag me' } })
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
    expect(engine.getSnapshot().nodes.find((entry) => entry.id === node.id)).toMatchObject({ x: 0, y: 0 })
    vi.useRealTimers()
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin(), historyPlugin({ debounceMs: 0 })]
    })

    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 200, y: 0, data: { content: 'B' } })
    engine.ext.history.clear()

    const edge = engine.ext.connections.createEdge({ from: first.id, to: second.id, data: { label: 'A->B' } })
    expect(edge).toBeDefined()

    engine.deleteNode(first.id)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.undo()
    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.ext.connections.getEdges()).toHaveLength(1)

    engine.ext.history.redo()
    expect(engine.ext.connections.getEdges()).toHaveLength(0)
  })
})
