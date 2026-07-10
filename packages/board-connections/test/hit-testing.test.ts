import { describe, expect, it } from 'vitest'
import { asNodeId, type BoardNode } from '@lupinum/board-core'
import { resolveNodeHandleAtWorldPoint } from '../src/hit-testing'

function node(id: string, zIndex: number): BoardNode {
  return {
    id: asNodeId(id),
    type: 'text',
    x: 20,
    y: 20,
    width: 120,
    height: 80,
    text: id,
    zIndex,
    locked: false,
    visible: true,
  }
}

describe('connection hit testing', () => {
  it('selects the highest visible node edge and returns a normalized offset', () => {
    const result = resolveNodeHandleAtWorldPoint(
      [node('behind', 1), node('front', 2)],
      { x: 80, y: 22 },
      8,
      12,
    )

    expect(result).toEqual({
      nodeId: asNodeId('front'),
      side: 'top',
      offset: 0.5,
    })
  })

  it('does not claim corners reserved for adjacent handles', () => {
    expect(
      resolveNodeHandleAtWorldPoint([node('node', 1)], { x: 21, y: 21 }, 8, 12),
    ).toBeNull()
  })
})
