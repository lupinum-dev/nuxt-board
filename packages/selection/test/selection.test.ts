import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { getSelectionBounds, toggleIds } from '../src'

describe('selection helpers', () => {
  it('computes selection bounds from the current engine snapshot', () => {
    const engine = createCanvasEngine()
    const first = engine.createNode({ type: 'text', x: 10, y: 20, width: 100, height: 80, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 220, y: 60, width: 120, height: 90, data: { content: 'B' } })

    engine.select([first.id, second.id])

    expect(getSelectionBounds(engine)).toEqual({
      minX: 10,
      minY: 20,
      maxX: 340,
      maxY: 150
    })
  })

  it('toggles ids in and out of a selection array', () => {
    expect(toggleIds(['a', 'b'], ['b', 'c']).sort()).toEqual(['a', 'c'])
  })
})
