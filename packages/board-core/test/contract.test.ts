import { describe, expect, it } from 'vitest'
import { asNodeId, BoardInputError, createBoardEngine } from '../src'
import type { BoardNode, JsonCanvasDocument } from '../src'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
} from '../src/internal'

describe('board-core public document API', () => {
  it('preserves frozen unknown JSON Canvas fields while canonical fields keep authority', () => {
    const future = { nested: { enabled: true }, values: [1, 2, 3] }
    const engine = createBoardEngine({
      initialDocument: {
        nodes: [
          {
            id: 'future-node',
            type: 'text',
            x: 10,
            y: 20,
            width: 100,
            height: 60,
            text: 'Before',
            'future-node-field': future,
          },
        ],
        'future-document-field': { revision: 2 },
      } as never,
    })

    future.nested.enabled = false
    engine.updateNode(asNodeId('future-node'), { text: 'After', x: 40 })
    engine.duplicateNodes([asNodeId('future-node')], { x: 20, y: 20 })
    const exported = engine.exportDocument() as JsonCanvasDocument &
      Record<string, unknown>
    const node = exported.nodes.find(
      (entry) => entry.id === 'future-node',
    ) as (typeof exported.nodes)[number] & Record<string, unknown>

    expect(exported['future-document-field']).toEqual({ revision: 2 })
    expect(node['future-node-field']).toEqual({
      nested: { enabled: true },
      values: [1, 2, 3],
    })
    expect(node.text).toBe('After')
    expect(node.x).toBe(40)
    expect(Object.isFrozen(node['future-node-field'])).toBe(true)
    expect(
      exported.nodes.every(
        (entry) =>
          (entry as typeof entry & Record<string, unknown>)[
            'future-node-field'
          ] !== undefined,
      ),
    ).toBe(true)
  })

  it('keeps node passthrough fields aligned through clipboard, delete, and merge remapping', () => {
    const engine = createBoardEngine({
      initialDocument: {
        nodes: [
          {
            id: 'source',
            type: 'text',
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            text: 'Source',
            'source-extra': { retained: true },
          },
        ],
        'x-lupinum-board': { selection: ['source'] },
      } as never,
    })

    engine.copySelected()
    engine.deleteNode(asNodeId('source'))
    const [pasted] = engine.pasteClipboard()
    expect(pasted).toBeDefined()

    engine.loadDocument(
      {
        nodes: [
          {
            id: pasted!.id,
            type: 'text',
            x: 200,
            y: 0,
            width: 100,
            height: 60,
            text: 'Merged',
            'merged-extra': { retained: true },
          },
        ],
      },
      { mode: 'merge' },
    )

    const exported = engine.exportDocument()
    expect(exported.nodes).toHaveLength(2)
    expect(exported.nodes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'source' })]),
    )
    expect(exported.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pasted!.id,
          'source-extra': { retained: true },
        }),
        expect.objectContaining({
          'merged-extra': { retained: true },
        }),
      ]),
    )
  })

  it('rejects invalid persisted edge data without requiring the connections plugin', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const sparse: unknown[] = []
    sparse.length = 2
    sparse[1] = 'value'

    for (const data of [
      cyclic,
      { callback: () => undefined },
      { instance: new Date() },
      { value: Number.POSITIVE_INFINITY },
      { value: Number.NEGATIVE_INFINITY },
      { value: Number.NaN },
      { value: undefined },
      { value: Symbol('value') },
      { value: 1n },
      { value: sparse },
      ['not-an-object'],
    ]) {
      const engine = createBoardEngine()
      expect(() =>
        engine.loadDocument({
          nodes: [],
          'x-lupinum-board': { edges: { ghost: { data } } },
        }),
      ).toThrow(BoardInputError)
    }
  })

  it('rejects property shapes that JSON cannot represent without executing accessors', () => {
    let getterCalls = 0
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        getterCalls += 1
        return 'unsafe'
      },
    })
    const hidden = Object.defineProperty({}, 'hidden', {
      enumerable: false,
      value: () => undefined,
    })
    const symbolKey = { [Symbol('hidden')]: 'value' }

    for (const data of [accessor, hidden, symbolKey]) {
      const engine = createBoardEngine()
      expect(() =>
        engine.loadDocument({
          nodes: [],
          'x-lupinum-board': { edges: { ghost: { data } } },
        }),
      ).toThrow(BoardInputError)
    }
    expect(getterCalls).toBe(0)
  })

  it('rejects class instances at the document root', () => {
    class DocumentInput {
      nodes: unknown[] = []
    }

    expect(() => createBoardEngine().loadDocument(new DocumentInput())).toThrow(
      BoardInputError,
    )
  })

  it.each([
    ['zero camera zoom', { camera: { z: 0 } }],
    ['negative edge snap threshold', { grid: { edgeSnapThreshold: -1 } }],
    ['fractional major grid interval', { grid: { majorEvery: 1.5 } }],
  ])('rejects invalid semantic metadata: %s', (_label, metadata) => {
    const engine = createBoardEngine()
    expect(() =>
      engine.loadDocument({ nodes: [], 'x-lupinum-board': metadata }),
    ).toThrow(/Invalid board document/)
  })

  it('exports persisted state with canonical Lupinum metadata', () => {
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
    expect(document['x-lupinum-board']).toMatchObject({
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
      'x-lupinum-board': {
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
    expect(engine.exportDocument()['x-lupinum-board']?.nextZIndex).toBe(7)
  })

  it('imports legacy metadata but exports only the canonical key', () => {
    const engine = createBoardEngine()
    engine.loadDocument({
      nodes: [
        {
          id: 'legacy',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          text: 'legacy',
        },
      ],
      'x-vue-board': {
        nodes: { legacy: { zIndex: 4, locked: true } },
      },
    })

    expect(engine.getNode(asNodeId('legacy'))).toMatchObject({
      zIndex: 4,
      locked: true,
    })
    expect(engine.exportDocument()['x-lupinum-board']).toBeDefined()
    expect(engine.exportDocument()).not.toHaveProperty('x-vue-board')
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
        'x-lupinum-board': {
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
        'x-lupinum-board': {
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
        'x-lupinum-board': {
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
          pluginEngine.updatePluginState((state) => ({
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
          'x-lupinum-board': {
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
