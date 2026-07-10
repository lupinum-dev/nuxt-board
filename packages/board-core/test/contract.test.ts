import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '../src'
import type { BoardNode, JsonCanvasDocument } from '../src'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
} from '../src/internal'

describe('board-core public document API', () => {
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

    const document = JSON.parse(engine.exportJSON()) as JsonCanvasDocument

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

    engine.importJSON(JSON.stringify(document), 'replace')
    const node: BoardNode = engine.getNode(asNodeId('node-a'))

    expect(node).toMatchObject({
      id: asNodeId('node-a'),
      type: 'text',
      text: 'hello',
      zIndex: 6,
      locked: true,
      visible: true,
    })
    expect(engine.getSnapshot().nextZIndex).toBe(7)
  })

  it('does not accept runtime snapshots as persisted documents', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', text: 'runtime' })

    expect(() =>
      engine.importJSON(JSON.stringify(engine.getSnapshot()), 'replace'),
    ).toThrow(/runtime field "camera"/)
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
    const before = engine.getSnapshot()

    expect(() =>
      engine.importJSON(JSON.stringify(document), 'replace'),
    ).toThrow(error)

    expect(engine.getSnapshot()).toEqual(before)
  })

  it('rejects invalid JSON Canvas documents before mutating state', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({ type: 'text', text: 'keep' })
    const before = engine.getSnapshot()

    expect(() =>
      engine.importJSON(
        JSON.stringify({
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
      ),
    ).toThrow(/missing required text/)

    expect(engine.getSnapshot()).toEqual(before)
    expect(engine.getNode(existing.id).text).toBe('keep')
  })

  it('rejects edge documents without the connections extension before mutating state', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({ type: 'text', text: 'keep' })
    const before = engine.getSnapshot()

    expect(() =>
      engine.importJSON(
        JSON.stringify({
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
      ),
    ).toThrow(/edges require the connections extension/)

    expect(engine.getSnapshot()).toEqual(before)
    expect(engine.getNode(existing.id).text).toBe('keep')
  })

  it('rolls back core and extension state when an extension import hook fails', () => {
    let extensionState!: () => { imports: number }
    const failingFeature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failing-import',
      slice: {
        initial: { imports: 0 },
        reducer(state: { imports: number }, action) {
          return action.type === 'FEATURE_ACTION' &&
            action.feature === 'failing-import'
            ? { imports: state.imports + 1 }
            : state
        },
      },
      persistence: {
        importDocument(extensionEngine) {
          extensionEngine.dispatch({
            type: 'FEATURE_ACTION',
            feature: 'failing-import',
            action: { type: 'IMPORT_STARTED' },
          })
          throw new Error('extension import failed')
        },
      },
      install(extensionEngine) {
        extensionState = () => extensionEngine.getFeatureState()
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
    const before = engine.getSnapshot()

    expect(() =>
      engine.importJSON(
        JSON.stringify({
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
        }),
        'replace',
      ),
    ).toThrow(/extension import failed/)

    expect(engine.getSnapshot()).toEqual(before)
    expect(extensionState()).toEqual({ imports: 0 })
  })
})
