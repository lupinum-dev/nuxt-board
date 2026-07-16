import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '../src'
import type { BoardNode, JsonCanvasDocument } from '../src'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
} from '../src/internal'

describe('board-core public document API', () => {
  it.each([
    ['zero camera zoom', { camera: { z: 0 } }],
    ['negative edge snap threshold', { grid: { edgeSnapThreshold: -1 } }],
    ['fractional major grid interval', { grid: { majorEvery: 1.5 } }],
  ])('rejects invalid semantic metadata: %s', (_label, metadata) => {
    const engine = createBoardEngine()
    expect(() =>
      engine.loadDocument({ nodes: [], 'x-vue-board': metadata }),
    ).toThrow(/Invalid board document/)
  })

  it('exports persisted state as JSON Canvas with board metadata under x-vue-board', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      id: asNodeId('note-1'),
      type: 'text',
      x: 12,
      y: 24,
      width: 180,
      height: 90,
      text: 'persist me',
    })
    engine.select(node.id)

    const document = engine.exportDocument() as JsonCanvasDocument

    expect(document.nodes).toEqual([
      {
        id: node.id,
        type: 'text',
        x: 12,
        y: 24,
        width: 180,
        height: 90,
        text: 'persist me',
      },
    ])
    expect(document).not.toHaveProperty('camera')
    expect(document).not.toHaveProperty('grid')
    expect(document['x-vue-board']).toMatchObject({
      camera: { x: 0, y: 0, z: 1 },
      selection: [node.id],
      nodes: {
        [node.id]: { zIndex: node.zIndex, locked: false, visible: true },
      },
    })
  })

  it('imports JsonCanvasDocument and returns honest BoardNode values', () => {
    const document: JsonCanvasDocument = {
      nodes: [
        {
          id: asNodeId('node-a'),
          type: 'text',
          x: 10,
          y: 20,
          width: 120,
          height: 80,
          text: 'hello',
        },
      ],
      'x-vue-board': {
        nextZIndex: 7,
        nodes: {
          'node-a': { zIndex: 6, locked: true, visible: true },
        },
      },
    }
    const engine = createBoardEngine()

    engine.loadDocument(document, { mode: 'replace' })
    const node: BoardNode = engine.getNode(asNodeId('node-a'))

    expect(node).toMatchObject({
      id: asNodeId('node-a'),
      type: 'text',
      text: 'hello',
      zIndex: 6,
      locked: true,
      visible: true,
    })
    expect(engine.exportDocument()['x-vue-board']?.nextZIndex).toBe(7)
  })

  it('does not accept runtime snapshots as persisted documents', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', text: 'runtime' })

    expect(() =>
      engine.loadDocument(engine.getState(), { mode: 'replace' }),
    ).toThrow(/missing nodes array/)
  })

  it.each([
    ['missing nodes', {}, /missing nodes array/],
    [
      'duplicate node ids',
      {
        nodes: [
          {
            id: 'dup',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: 'dup',
            type: 'text',
            x: 160,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
      },
      /duplicate node id/,
    ],
    [
      'duplicate edge ids',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: 'b',
            type: 'text',
            x: 160,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
        edges: [
          { id: 'edge', fromNode: 'a', toNode: 'b' },
          { id: 'edge', fromNode: 'b', toNode: 'a' },
        ],
      },
      /duplicate edge id/,
    ],
    [
      'missing edge endpoint',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
        ],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'missing' }],
      },
      /references a missing node/,
    ],
    [
      'invalid edge enum',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: 'b',
            type: 'text',
            x: 160,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'b', toEnd: 'dot' }],
      },
      /unsupported toEnd/,
    ],
    [
      'malformed metadata',
      {
        nodes: [],
        'x-vue-board': {
          grid: { pattern: 'checkerboard' },
        },
      },
      /grid\.pattern/,
    ],
    [
      'invalid node metadata parent id',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
        ],
        'x-vue-board': {
          nodes: {
            a: { parentId: 42 },
          },
        },
      },
      /invalid parentId/,
    ],
    [
      'invalid edge metadata data',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: 'b',
            type: 'text',
            x: 160,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'b' }],
        'x-vue-board': {
          edges: {
            edge: { data: ['not', 'an', 'object'] },
          },
        },
      },
      /invalid data/,
    ],
    [
      'invalid node color',
      {
        nodes: [
          {
            id: 'a',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            color: 'tomato',
            text: 'A',
          },
        ],
      },
      /invalid color/,
    ],
  ])('rejects invalid persisted documents: %s', (_label, document, error) => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', text: 'keep' })
    const before = engine.getState()

    expect(() => engine.loadDocument(document, { mode: 'replace' })).toThrow(
      error,
    )

    expect(engine.getState()).toEqual(before)
  })

  it('rejects invalid JSON Canvas documents before mutating state', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({ type: 'text', text: 'keep' })
    const before = engine.getState()

    expect(() =>
      engine.loadDocument({
        nodes: [
          {
            id: 'bad',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
          },
        ],
      }),
    ).toThrow(/missing required text/)

    expect(engine.getState()).toEqual(before)
    expect(engine.getNode(existing.id).text).toBe('keep')
  })

  it('rejects edge documents without the connections plugin before mutating state', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({ type: 'text', text: 'keep' })
    const before = engine.getState()

    expect(() =>
      engine.loadDocument({
        nodes: [
          {
            id: 'source',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'Source',
          },
          {
            id: 'target',
            type: 'text',
            x: 180,
            y: 0,
            width: 120,
            height: 80,
            text: 'Target',
          },
        ],
        edges: [{ id: 'edge', fromNode: 'source', toNode: 'target' }],
      }),
    ).toThrow(/edges require the connections plugin/)

    expect(engine.getState()).toEqual(before)
    expect(engine.getNode(existing.id).text).toBe('keep')
  })

  it('rolls back core and plugin state when a plugin import hook fails', () => {
    let pluginState!: () => { imports: number }
    const failingFeature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failing-import',
      slice: {
        initial: { imports: 0 },
      },
      persistence: {
        loadDocument(pluginEngine) {
          pluginEngine.updatePluginState<{ imports: number }>((state) => ({
            imports: state.imports + 1,
          }))
          throw new Error('plugin import failed')
        },
      },
      install(pluginEngine) {
        pluginState = () => pluginEngine.getPluginState()
      },
    })
    const engine = createBoardEngine({
      plugins: [failingFeature],
    })
    const existing = engine.createNode({
      id: asNodeId('keep'),
      type: 'text',
      text: 'keep',
    })
    engine.select(existing.id)
    engine.panBy(12, 8)
    const before = engine.getState()

    expect(() =>
      engine.loadDocument(
        {
          nodes: [
            {
              id: 'replacement',
              type: 'text',
              x: 50,
              y: 60,
              width: 120,
              height: 80,
              text: 'replacement',
            },
          ],
          'x-vue-board': {
            selection: ['replacement'],
            nextZIndex: 10,
          },
        },
        { mode: 'replace' },
      ),
    ).toThrow(/plugin import failed/)

    expect(engine.getState()).toEqual(before)
    expect(pluginState()).toEqual({ imports: 0 })
  })
})
