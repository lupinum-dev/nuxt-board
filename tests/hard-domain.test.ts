import { describe, expect, it } from 'vitest'
import { asEdgeId, asNodeId, createBoardEngine } from '@lupinum/board-core'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
} from '@lupinum/board-core/internal'
import { connectionsPlugin } from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'

describe('hard board domain regressions', () => {
  it('preserves grouped edges through delete, undo, redo, export, and import', () => {
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [historyPlugin(), connectionsPlugin()],
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
    engine.plugins.connections.createEdge({
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
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)

    engine.plugins.history.undo()
    expect(engine.hasNode(asNodeId('group'))).toBe(true)
    expect(engine.getNode(asNodeId('inner')).parentId).toBe(asNodeId('group'))
    expect(engine.plugins.connections.getEdges()).toEqual([
      expect.objectContaining({
        id: asEdgeId('edge'),
        from: asNodeId('inner'),
        to: asNodeId('outer'),
        label: 'crosses boundary',
        data: { kind: 'regression' },
      }),
    ])

    engine.plugins.history.redo()
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)

    engine.plugins.history.undo()
    const exported = engine.exportDocument()
    const restored = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    restored.loadDocument(exported, { mode: 'replace' })

    expect(restored.getNode(asNodeId('inner')).parentId).toBe(asNodeId('group'))
    expect(restored.plugins.connections.getEdges()).toEqual([
      expect.objectContaining({
        id: asEdgeId('edge'),
        from: asNodeId('inner'),
        to: asNodeId('outer'),
        data: { kind: 'regression' },
      }),
    ])
  })

  it('rolls back failed feature imports without durable edge state, history, or public edge events', () => {
    let failingFeatureState!: () => { imports: number }
    const failingFeature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failing-import',
      slice: {
        initial: { imports: 0 },
      },
      persistence: {
        loadDocument(engine) {
          engine.updatePluginState<{ imports: number }>((state) => ({
            imports: state.imports + 1,
          }))
          throw new Error('feature import failed')
        },
      },
      install(engine) {
        failingFeatureState = () => engine.getPluginState()
      },
    })
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [historyPlugin(), connectionsPlugin(), failingFeature],
    })
    engine.createNode({
      id: asNodeId('keep-a'),
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Keep A',
    })
    engine.createNode({
      id: asNodeId('keep-b'),
      type: 'text',
      x: 180,
      y: 0,
      width: 120,
      height: 80,
      text: 'Keep B',
    })
    engine.plugins.connections.createEdge({
      id: asEdgeId('keep-edge'),
      from: asNodeId('keep-a'),
      to: asNodeId('keep-b'),
      data: {},
    })
    engine.plugins.history.clear()
    const before = engine.getState()
    const edgeEvents: string[] = []
    const historyEvents: string[] = []
    engine.on('edge:created', (edge) => edgeEvents.push(`created:${edge.id}`))
    engine.on('edge:deleted', (id) => edgeEvents.push(`deleted:${id}`))
    engine.on('history:push', (entry) => historyEvents.push(entry.label))

    expect(() =>
      engine.loadDocument(
        {
          nodes: [
            {
              id: asNodeId('next-a'),
              type: 'text',
              x: 0,
              y: 120,
              width: 120,
              height: 80,
              text: 'Next A',
            },
            {
              id: asNodeId('next-b'),
              type: 'text',
              x: 180,
              y: 120,
              width: 120,
              height: 80,
              text: 'Next B',
            },
          ],
          edges: [
            {
              id: asEdgeId('next-edge'),
              fromNode: asNodeId('next-a'),
              toNode: asNodeId('next-b'),
            },
          ],
        },
        { mode: 'replace' },
      ),
    ).toThrow(/feature import failed/)

    expect(engine.getState()).toEqual(before)
    expect(engine.plugins.connections.getEdges()).toEqual([
      expect.objectContaining({ id: asEdgeId('keep-edge') }),
    ])
    expect(engine.plugins.history.getState()).toMatchObject({
      undoDepth: 0,
      redoDepth: 0,
      current: null,
    })
    expect(failingFeatureState()).toEqual({ imports: 0 })
    expect(edgeEvents).toEqual([])
    expect(historyEvents).toEqual([])
  })
})
