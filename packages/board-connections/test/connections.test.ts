import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin, routeEdgePath } from '../src'

describe('connections plugin', () => {
  it('creates edges, queries them, and removes them with deleted nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 200, y: 100, data: { content: 'B' } })

    const edge = engine.ext.connections.createEdge({ from: first.id, to: second.id, data: { label: 'depends on' } })
    expect(edge).toBeDefined()
    expect(engine.ext.connections.getEdgesBetween(first.id, second.id)).toHaveLength(1)
    expect(edge.data).toMatchObject({ label: 'depends on' })

    engine.deleteNode(first.id)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)
  })

  it('removes edges when deleting a group that still has child nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()],
      grid: { snap: false }
    })
    const group = engine.createNode({
      type: 'group',
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      select: false
    })
    const inner = engine.createNode({
      type: 'text',
      x: 40,
      y: 40,
      width: 80,
      height: 60,
      parentId: group.id,
      select: false,
      data: { content: 'inner' }
    })
    const outer = engine.createNode({
      type: 'text',
      x: 400,
      y: 40,
      width: 80,
      height: 60,
      select: false,
      data: { content: 'outer' }
    })
    engine.syncGroupZOrder(group.id)
    engine.ext.connections.createEdge({ from: inner.id, to: outer.id, data: {} })
    expect(engine.ext.connections.getEdges()).toHaveLength(1)

    engine.select([group.id])
    engine.deleteSelected()

    expect(engine.getSnapshot().nodes).toHaveLength(1)
    expect(engine.ext.connections.getEdges()).toHaveLength(0)
  })

  it('routes straight and bezier paths', () => {
    expect(routeEdgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'straight')).toBe('M 0 0 L 100 50')
    expect(routeEdgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'bezier')).toContain('C')
  })

  it('throws when creating an edge with non-existent nodes', () => {
    const engine = createBoardEngine({
      plugins: [connectionPlugin()]
    })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })

    expect(() => engine.ext.connections.createEdge({ from: node.id, to: asNodeId('non-existent'), data: {} })).toThrow(
      'target node'
    )
    expect(() => engine.ext.connections.createEdge({ from: asNodeId('non-existent'), to: node.id, data: {} })).toThrow(
      'source node'
    )
  })
})
