import { describe, expect, it, vi } from 'vitest'
import {
  asEdgeId,
  asNodeId,
  BoardConflictError,
  BoardInputError,
  type BoardEngine,
  createBoardEngine,
} from '@lupinum/board-core'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
} from '@lupinum/board-core/internal'
import {
  buildConnectionRoute,
  connectionsPlugin,
  resolveAutoAnchorSide,
  resolveConnectionEndpoint,
  resolveEdgeRenderState,
  type ConnectionsApi,
} from '../src'

function expectEdgesReferenceExistingNodes(
  engine: BoardEngine<{ connections: ConnectionsApi }>,
): void {
  for (const edge of engine.plugins.connections.getEdges()) {
    expect(engine.hasNode(edge.from)).toBe(true)
    expect(engine.hasNode(edge.to)).toBe(true)
  }
}

describe('connections plugin', () => {
  it('rejects duplicate edge ids and invalid edge boundaries', () => {
    const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
    const source = engine.createNode({ type: 'text', text: 'Source' })
    const target = engine.createNode({ type: 'text', text: 'Target' })
    const id = asEdgeId('duplicate-edge')

    engine.plugins.connections.createEdge({
      id,
      from: source.id,
      to: target.id,
      data: {},
    })

    expect(() =>
      engine.plugins.connections.createEdge({
        id,
        from: source.id,
        to: target.id,
        data: {},
      }),
    ).toThrow(BoardConflictError)
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)

    expect(() =>
      engine.plugins.connections.createEdge({
        from: source.id,
        to: target.id,
        fromAnchor: { side: 'left', offset: 2 },
        data: {},
      }),
    ).toThrow(BoardInputError)
    expect(() =>
      engine.plugins.connections.createEdge({
        from: source.id,
        to: target.id,
        color: 'tomato' as never,
        data: {},
      }),
    ).toThrow(BoardInputError)
  })

  it('exposes resolved connection defaults through the public plugin API', () => {
    const engine = createBoardEngine({
      plugins: [
        connectionsPlugin({
          routing: 'smooth-step',
          endpointMode: 'manual',
          defaultArrow: 'both',
        }),
      ],
    })

    expect(engine.plugins.connections.getConfig()).toEqual({
      routing: 'smooth-step',
      endpointMode: 'manual',
      defaultArrow: 'both',
    })
    expect(
      Object.keys(engine.plugins.connections).filter((key) =>
        key.startsWith('__'),
      ),
    ).toEqual([])
  })

  it('creates edges, queries them, and removes them with deleted nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
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
      y: 100,
      text: 'Node',
    })

    const edge = engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      label: 'depends on',
      color: '#0f766e',
      data: {},
    })
    expect(edge).toBeDefined()
    expect(
      engine.plugins.connections.getEdgesBetween(first.id, second.id),
    ).toHaveLength(1)
    expect(edge.label).toBe('depends on')
    expect(edge.color).toBe('#0f766e')

    engine.deleteNode(first.id)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
  })

  it('exports and imports edges through the connections plugin only', () => {
    const firstId = asNodeId('first')
    const secondId = asNodeId('second')
    const edgeId = asEdgeId('edge-a')
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
      initialDocument: {
        nodes: [
          {
            id: firstId,
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: secondId,
            type: 'text',
            x: 200,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
      },
    })
    engine.plugins.connections.createEdge({
      id: edgeId,
      from: firstId,
      to: secondId,
      fromAnchor: { side: 'right', offset: 0.5 },
      toAnchor: { side: 'left', offset: 0.5 },
      label: 'edge label',
      color: '#0f766e',
      data: { weight: 2 },
      zIndex: 4,
    })

    const exported = engine.exportDocument()
    expect(exported.edges).toEqual([
      {
        id: edgeId,
        fromNode: firstId,
        fromSide: 'right',
        toNode: secondId,
        toSide: 'left',
        fromEnd: 'none',
        toEnd: 'arrow',
        color: '#0f766e',
        label: 'edge label',
      },
    ])
    expect(exported['x-lupinum-board']?.edges?.[edgeId]).toEqual({
      zIndex: 4,
      data: { weight: 2 },
    })

    const restored = createBoardEngine({ plugins: [connectionsPlugin()] })
    restored.loadDocument(exported, { mode: 'replace' })

    expect(restored.plugins.connections.getEdges()).toEqual([
      expect.objectContaining({
        id: edgeId,
        from: firstId,
        to: secondId,
        label: 'edge label',
        color: '#0f766e',
        data: { weight: 2 },
        zIndex: 4,
      }),
    ])
  })

  it('fails clearly instead of silently dropping imported edges without the connections plugin', () => {
    const withoutPlugin = createBoardEngine()

    expect(() =>
      withoutPlugin.loadDocument({
        nodes: [
          {
            id: 'first',
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'A',
          },
          {
            id: 'second',
            type: 'text',
            x: 200,
            y: 0,
            width: 120,
            height: 80,
            text: 'B',
          },
        ],
        edges: [{ id: 'edge-a', fromNode: 'first', toNode: 'second' }],
      }),
    ).toThrow(/edges require the connections plugin/)

    expect(withoutPlugin.getState().nodes.size).toBe(0)
  })

  it('removes edges when deleting a group that still has child nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
      grid: { snap: false },
    })
    const group = engine.createNode({
      type: 'group',
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      select: false,
    })
    const inner = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 80,
      height: 60,
      parentId: group.id,
      select: false,
      text: 'Node',
    })
    const outer = engine.createNode({
      type: 'text',
      x: 400,
      y: 40,
      width: 80,
      height: 60,
      select: false,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
      from: inner.id,
      to: outer.id,
      data: {},
    })
    expect(engine.plugins.connections.getEdges()).toHaveLength(1)

    engine.select([group.id])
    engine.deleteSelected()

    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expectEdgesReferenceExistingNodes(engine)
  })

  it('clears stale edges when replacing the board document', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
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
      y: 100,
      text: 'Node',
    })
    engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      data: {},
    })

    engine.loadDocument(
      {
        nodes: [],
        'x-lupinum-board': {
          selection: [],
          nextZIndex: 1,
        },
      },
      { mode: 'replace' },
    )

    expect(engine.getState().nodes.size).toBe(0)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expectEdgesReferenceExistingNodes(engine)
  })

  it('hydrates initialDocument edges after installing the connections plugin', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
      initialDocument: {
        nodes: [
          {
            id: asNodeId('source'),
            type: 'text',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            text: 'Source',
          },
          {
            id: asNodeId('target'),
            type: 'text',
            x: 240,
            y: 0,
            width: 120,
            height: 80,
            text: 'Target',
          },
        ],
        edges: [
          {
            id: 'edge-1' as never,
            fromNode: asNodeId('source'),
            toNode: asNodeId('target'),
            fromSide: 'right',
            toSide: 'left',
            label: 'initial',
          },
        ],
      },
    })

    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(engine.plugins.connections.getEdges()[0]).toMatchObject({
      from: asNodeId('source'),
      to: asNodeId('target'),
      label: 'initial',
    })
  })

  it('remaps imported edges to cloned node ids during merge imports', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    engine.createNode({
      id: asNodeId('source'),
      type: 'text',
      x: 0,
      y: 0,
      text: 'Existing source',
    })
    engine.createNode({
      id: asNodeId('target'),
      type: 'text',
      x: 240,
      y: 0,
      text: 'Existing target',
    })

    engine.loadDocument(
      {
        nodes: [
          {
            id: 'source',
            type: 'text',
            x: 0,
            y: 160,
            width: 120,
            height: 80,
            text: 'Imported source',
          },
          {
            id: 'target',
            type: 'text',
            x: 240,
            y: 160,
            width: 120,
            height: 80,
            text: 'Imported target',
          },
        ],
        edges: [
          {
            id: 'edge-merge',
            fromNode: 'source',
            toNode: 'target',
            label: 'merged',
          },
        ],
      },
      { mode: 'merge' },
    )

    const imported = Array.from(engine.getState().nodes.values()).filter(
      (node) => node.text?.startsWith('Imported'),
    )
    const edge = engine.plugins.connections.getEdges()[0]
    expect(imported).toHaveLength(2)
    expect(edge).toMatchObject({ label: 'merged' })
    expect(imported.map((node) => node.id)).toContain(edge?.from)
    expect(imported.map((node) => node.id)).toContain(edge?.to)
    expectEdgesReferenceExistingNodes(engine)
  })

  it('keeps every edge attached to existing nodes across replace and merge imports', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const first = engine.createNode({
      id: asNodeId('first'),
      type: 'text',
      x: 0,
      y: 0,
      text: 'First',
    })
    const second = engine.createNode({
      id: asNodeId('second'),
      type: 'text',
      x: 220,
      y: 0,
      text: 'Second',
    })
    engine.plugins.connections.createEdge({
      id: asEdgeId('stale-edge'),
      from: first.id,
      to: second.id,
      data: {},
    })

    engine.loadDocument(
      {
        nodes: [
          {
            id: 'replacement-a',
            type: 'text',
            x: 0,
            y: 160,
            width: 120,
            height: 80,
            text: 'Replacement A',
          },
          {
            id: 'replacement-b',
            type: 'text',
            x: 220,
            y: 160,
            width: 120,
            height: 80,
            text: 'Replacement B',
          },
        ],
        edges: [
          {
            id: 'replacement-edge',
            fromNode: 'replacement-a',
            toNode: 'replacement-b',
          },
        ],
      },
      { mode: 'replace' },
    )

    expect(engine.plugins.connections.getEdges()).toHaveLength(1)
    expect(
      engine.plugins.connections.getEdge(asEdgeId('stale-edge')),
    ).toBeUndefined()
    expectEdgesReferenceExistingNodes(engine)

    engine.loadDocument(
      {
        nodes: [
          {
            id: 'replacement-a',
            type: 'text',
            x: 0,
            y: 320,
            width: 120,
            height: 80,
            text: 'Merged A',
          },
          {
            id: 'replacement-b',
            type: 'text',
            x: 220,
            y: 320,
            width: 120,
            height: 80,
            text: 'Merged B',
          },
        ],
        edges: [
          {
            id: 'replacement-edge',
            fromNode: 'replacement-a',
            toNode: 'replacement-b',
          },
        ],
      },
      { mode: 'merge' },
    )

    expect(engine.plugins.connections.getEdges()).toHaveLength(2)
    expectEdgesReferenceExistingNodes(engine)
  })

  it('rolls back imported connection state when a later feature import fails', () => {
    const failingFeature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failing-import',
      persistence: {
        loadDocument() {
          throw new Error('feature import failed')
        },
      },
      install() {},
    })
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), failingFeature],
    })
    const keepA = engine.createNode({
      id: asNodeId('keep-a'),
      type: 'text',
      x: 0,
      y: 0,
      text: 'Keep A',
    })
    const keepB = engine.createNode({
      id: asNodeId('keep-b'),
      type: 'text',
      x: 220,
      y: 0,
      text: 'Keep B',
    })
    const keepEdge = engine.plugins.connections.createEdge({
      id: asEdgeId('keep-edge'),
      from: keepA.id,
      to: keepB.id,
      data: {},
    })
    const before = engine.getState()

    expect(() =>
      engine.loadDocument(
        {
          nodes: [
            {
              id: 'new-a',
              type: 'text',
              x: 0,
              y: 160,
              width: 120,
              height: 80,
              text: 'New A',
            },
            {
              id: 'new-b',
              type: 'text',
              x: 220,
              y: 160,
              width: 120,
              height: 80,
              text: 'New B',
            },
          ],
          edges: [{ id: 'new-edge', fromNode: 'new-a', toNode: 'new-b' }],
        },
        { mode: 'replace' },
      ),
    ).toThrow(/feature import failed/)

    expect(engine.getState()).toEqual(before)
    expect(engine.plugins.connections.getEdges()).toEqual([keepEdge])
    expectEdgesReferenceExistingNodes(engine)
  })

  it('resolves auto sides with hysteresis across diagonal thresholds', () => {
    const source = { x: 0, y: 0, width: 100, height: 60 }
    const target = { x: 140, y: 20, width: 100, height: 60 }
    expect(resolveAutoAnchorSide(source, target, 'source')).toBe('right')
    expect(resolveAutoAnchorSide(target, source, 'target')).toBe('left')

    const nearlyDiagonal = { x: 70, y: 80, width: 100, height: 60 }
    expect(
      resolveAutoAnchorSide(source, nearlyDiagonal, 'source', 'right'),
    ).toBe('right')
  })

  it('locks auto endpoints to the center of the resolved side', () => {
    const left = { id: 'left' as never, x: 0, y: 0, width: 120, height: 80 }
    const right = {
      id: 'right' as never,
      x: 280,
      y: 120,
      width: 120,
      height: 80,
    }
    const below = {
      id: 'below' as never,
      x: 20,
      y: 220,
      width: 120,
      height: 80,
    }
    const edge = {
      id: 'edge' as never,
      from: left.id,
      to: right.id,
      data: {},
      zIndex: 1,
    }

    const horizontalSource = resolveConnectionEndpoint(
      edge,
      left,
      right,
      'source',
    )
    const horizontalTarget = resolveConnectionEndpoint(
      edge,
      right,
      left,
      'target',
    )
    const verticalSource = resolveConnectionEndpoint(
      { ...edge, to: below.id },
      left,
      below,
      'source',
    )

    expect(horizontalSource.side).toBe('right')
    expect(horizontalSource.offset).toBe(0.5)
    expect(horizontalSource.point).toEqual({ x: 120, y: 40 })
    expect(horizontalTarget.side).toBe('left')
    expect(horizontalTarget.offset).toBe(0.5)
    expect(horizontalTarget.point).toEqual({ x: 280, y: 160 })
    expect(verticalSource.side).toBe('bottom')
    expect(verticalSource.offset).toBe(0.5)
    expect(verticalSource.point).toEqual({ x: 60, y: 80 })
  })

  it('preserves explicit non-center anchors', () => {
    const source = { id: 'source' as never, x: 0, y: 0, width: 120, height: 80 }
    const target = {
      id: 'target' as never,
      x: 280,
      y: 120,
      width: 120,
      height: 80,
    }

    const resolved = resolveConnectionEndpoint(
      {
        id: 'edge' as never,
        from: source.id,
        to: target.id,
        fromAnchor: { side: 'right', offset: 0.2 },
        data: {},
        zIndex: 1,
      },
      source,
      target,
      'source',
    )

    expect(resolved.side).toBe('right')
    expect(resolved.offset).toBe(0.2)
    expect(resolved.point).toEqual({ x: 120, y: 16 })
    expect(resolved.kind).toBe('explicit')
  })

  it('builds directional routes for bezier, smooth-step, step, and straight paths', () => {
    const source = {
      nodeId: 'a' as never,
      node: { id: 'a' as never, x: 0, y: 0, width: 100, height: 80 },
      side: 'right' as const,
      offset: 0.5,
      point: { x: 100, y: 40 },
      kind: 'explicit' as const,
    }
    const target = {
      nodeId: 'b' as never,
      node: { id: 'b' as never, x: 260, y: 120, width: 100, height: 80 },
      side: 'left' as const,
      offset: 0.5,
      point: { x: 260, y: 160 },
      kind: 'explicit' as const,
    }

    expect(
      buildConnectionRoute({ source, target, routing: 'straight' }).path,
    ).toBe('M100 40 L260 160')
    expect(
      buildConnectionRoute({ source, target, routing: 'bezier' }).path,
    ).toContain('C')
    expect(
      buildConnectionRoute({ source, target, routing: 'smooth-step' }).path,
    ).toContain('Q')
    expect(
      buildConnectionRoute({ source, target, routing: 'step' }).path,
    ).not.toContain('Q')
  })

  it('resolves edge geometry with explicit anchors and route bounds', () => {
    const source = { id: 'source' as never, x: 0, y: 0, width: 100, height: 80 }
    const target = {
      id: 'target' as never,
      x: 260,
      y: 80,
      width: 100,
      height: 80,
    }
    const result = resolveEdgeRenderState(
      {
        id: 'edge' as never,
        from: source.id,
        to: target.id,
        fromAnchor: { side: 'bottom', offset: 0.25 },
        toAnchor: { side: 'top', offset: 0.75 },
        fromEnd: 'none',
        toEnd: 'arrow',
        label: 'route',
        data: {},
        zIndex: 1,
      },
      source,
      target,
      { routing: 'smooth-step' },
    )

    expect(result.source.side).toBe('bottom')
    expect(result.target.side).toBe('top')
    expect(result.route.bounds.maxX).toBeGreaterThan(result.route.bounds.minX)
    expect(result.route.bounds.maxY).toBeGreaterThan(result.route.bounds.minY)
  })

  it('updates edges and emits edge:updated while preserving identity fields', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
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
    const updated = vi.fn()
    engine.on('edge:updated', updated)

    const edge = engine.plugins.connections.createEdge({
      from: first.id,
      to: second.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      toAnchor: { side: 'left', offset: 0.75 },
      label: 'old',
      color: '#111827',
      data: { version: 1 },
    })

    const next = engine.plugins.connections.updateEdge(edge.id, {
      to: third.id,
      toAnchor: undefined,
      label: 'new',
      data: { version: 2 },
    })

    expect(next.id).toBe(edge.id)
    expect(next.zIndex).toBe(edge.zIndex)
    expect(next.from).toBe(first.id)
    expect(next.fromAnchor).toEqual({ side: 'right', offset: 0.25 })
    expect(next.to).toBe(third.id)
    expect(next.toAnchor).toBeUndefined()
    expect(next.label).toBe('new')
    expect(next.data).toEqual({ version: 2 })
    expect(engine.plugins.connections.getEdge(edge.id)).toMatchObject({
      id: edge.id,
      to: third.id,
      label: 'new',
    })
    expect(updated).toHaveBeenCalledTimes(1)
    expect(updated.mock.calls[0]?.[0]).toMatchObject({
      id: edge.id,
      to: third.id,
      label: 'new',
    })
    expect(updated.mock.calls[0]?.[1]).toMatchObject({
      id: edge.id,
      to: second.id,
      label: 'old',
    })
  })

  it('throws when creating an edge with non-existent nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })

    expect(() =>
      engine.plugins.connections.createEdge({
        from: node.id,
        to: asNodeId('non-existent'),
        data: {},
      }),
    ).toThrow('target node')
    expect(() =>
      engine.plugins.connections.createEdge({
        from: asNodeId('non-existent'),
        to: node.id,
        data: {},
      }),
    ).toThrow('source node')
  })
})
