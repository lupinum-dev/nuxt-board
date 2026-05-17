import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '../src'
import type { BoardNode, JsonCanvasDocument } from '../src'

describe('board-core public document API', () => {
  it('exports persisted state as JSON Canvas with board metadata under x-nuxt-board', () => {
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
    expect(document['x-nuxt-board']).toMatchObject({
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
      'x-nuxt-board': {
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
        'x-nuxt-board': {
          grid: { pattern: 'checkerboard' },
        },
      },
      /grid\.pattern/,
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
})
