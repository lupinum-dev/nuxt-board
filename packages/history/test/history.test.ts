import { describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { connectionPlugin } from '@canvas/connections'
import { historyPlugin } from '../src'

describe('history plugin', () => {
  it('undoes and redoes node deletion', () => {
    const engine = createCanvasEngine({
      plugins: [historyPlugin({ debounceMs: 0 })]
    })

    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Keep me' } })
    engine.select(node.id)
    engine.deleteSelected()
    expect(engine.getSnapshot().nodes).toHaveLength(0)

    expect(engine.undo).toBeDefined()
    engine.undo?.()
    expect(engine.getSnapshot().nodes).toHaveLength(1)

    engine.redo?.()
    expect(engine.getSnapshot().nodes).toHaveLength(0)
  })

  it('excludes camera commands and groups pointer updates', () => {
    vi.useFakeTimers()
    const engine = createCanvasEngine({
      plugins: [historyPlugin({ debounceMs: 20 })]
    })

    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Drag me' } })
    engine.clearHistory?.()
    engine.panBy(100, 40)
    expect(engine.getHistoryState?.().undoDepth).toBe(0)

    engine.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 40, y: 0 })
    engine.updatePointer(1, { x: 80, y: 0 })
    engine.endInteraction(1)

    vi.advanceTimersByTime(25)
    expect(engine.canUndo?.()).toBe(true)
    engine.undo?.()
    expect(engine.getSnapshot().nodes.find((entry) => entry.id === node.id)).toMatchObject({ x: 0, y: 0 })
    vi.useRealTimers()
  })

  it('restores connection plugin state during undo and redo', () => {
    const engine = createCanvasEngine({
      plugins: [connectionPlugin(), historyPlugin({ debounceMs: 0 })]
    })

    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 200, y: 0, data: { content: 'B' } })
    engine.clearHistory?.()

    const edge = engine.createEdge?.({ from: first.id, to: second.id, data: { label: 'A->B' } })
    expect(edge).toBeDefined()

    engine.deleteNode(first.id)
    expect(engine.getEdges?.()).toHaveLength(0)

    engine.undo?.()
    expect(engine.getSnapshot().nodes).toHaveLength(2)
    expect(engine.getEdges?.()).toHaveLength(1)

    engine.redo?.()
    expect(engine.getEdges?.()).toHaveLength(0)
  })
})
