import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { useMinimap } from '../src'

describe('minimap', () => {
  it('projects nodes and viewport into minimap space', () => {
    const engine = createCanvasEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({ type: 'text', x: 0, y: 0, width: 100, height: 80, data: { content: 'A' } })
    engine.createNode({ type: 'text', x: 600, y: 400, width: 100, height: 80, data: { content: 'B' } })

    const scope = effectScope()
    const minimap = scope.run(() => useMinimap(engine, { width: 200, height: 120 }))
    if (!minimap) {
      throw new Error('Minimap scope did not initialize.')
    }

    expect(minimap.minimapNodes.value).toHaveLength(2)
    expect(minimap.viewportRect.value.width).toBeGreaterThan(0)
    scope.stop()
  })
})
