import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { connectionPlugin, routeEdgePath } from '../src'

describe('connections plugin', () => {
  it('creates edges, queries them, and removes them with deleted nodes', () => {
    const engine = createCanvasEngine({
      plugins: [connectionPlugin()]
    })
    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 200, y: 100, data: { content: 'B' } })

    expect(engine.createEdge).toBeDefined()
    const edge = engine.createEdge?.({ from: first.id, to: second.id, data: { label: 'depends on' } })
    expect(edge).toBeDefined()
    expect(engine.getEdgesBetween?.(first.id, second.id)).toHaveLength(1)
    expect(edge?.data).toMatchObject({ label: 'depends on' })

    engine.deleteNode(first.id)
    expect(engine.getEdges?.()).toHaveLength(0)
  })

  it('routes straight and bezier paths', () => {
    expect(routeEdgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'straight')).toBe('M 0 0 L 100 50')
    expect(routeEdgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'bezier')).toContain('C')
  })
})
