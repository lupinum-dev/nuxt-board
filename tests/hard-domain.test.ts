import { describe, expect, it } from 'vitest'
import { asEdgeId, asNodeId, createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'

describe('hard board domain regressions', () => {
  it('preserves grouped edges through delete, undo, redo, export, and import', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      extensions: [historyPlugin({ debounceMs: 0 }), connectionPlugin()],
      initialDocument: {
        nodes: [
          {
            id: asNodeId('group'),
            type: 'group',
            x: 0,
            y: 0,
            width: 320,
            height: 240,
            label: 'Group',
          },
          {
            id: asNodeId('inner'),
            type: 'text',
            x: 40,
            y: 40,
            width: 120,
            height: 80,
            text: 'Inner',
          },
          {
            id: asNodeId('outer'),
            type: 'text',
            x: 420,
            y: 60,
            width: 120,
            height: 80,
            text: 'Outer',
          },
        ],
        'x-vue-board': {
          nodes: {
            group: { zIndex: 1, locked: false, visible: true },
            inner: {
              parentId: asNodeId('group'),
              zIndex: 2,
              locked: false,
              visible: true,
            },
            outer: { zIndex: 3, locked: false, visible: true },
          },
          nextZIndex: 4,
        },
      },
    })
    engine.ext.connections.createEdge({
      id: asEdgeId('edge'),
      from: asNodeId('inner'),
      to: asNodeId('outer'),
      label: 'crosses boundary',
      data: { kind: 'regression' },
    })

    engine.select(asNodeId('group'))
    engine.deleteSelected()
    expect(engine.hasNode(asNodeId('group'))).toBe(false)
    expect(engine.hasNode(asNodeId('inner'))).toBe(false)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.undo()
    expect(engine.hasNode(asNodeId('group'))).toBe(true)
    expect(engine.getNode(asNodeId('inner')).parentId).toBe(asNodeId('group'))
    expect(engine.ext.connections.getEdges()).toEqual([
      expect.objectContaining({
        id: asEdgeId('edge'),
        from: asNodeId('inner'),
        to: asNodeId('outer'),
        label: 'crosses boundary',
        data: { kind: 'regression' },
      }),
    ])

    engine.ext.history.redo()
    expect(engine.ext.connections.getEdges()).toHaveLength(0)

    engine.ext.history.undo()
    const exported = engine.exportJSON()
    const restored = createBoardEngine({
      extensions: [connectionPlugin()],
    })
    restored.importJSON(exported, 'replace')

    expect(restored.getNode(asNodeId('inner')).parentId).toBe(asNodeId('group'))
    expect(restored.ext.connections.getEdges()).toEqual([
      expect.objectContaining({
        id: asEdgeId('edge'),
        from: asNodeId('inner'),
        to: asNodeId('outer'),
        data: { kind: 'regression' },
      }),
    ])
  })
})
