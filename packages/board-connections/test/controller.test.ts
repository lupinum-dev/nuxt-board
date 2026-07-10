import { describe, expect, it } from 'vitest'
import { asNodeId } from '@lupinum/board-core'
import { advanceConnectionDrag } from '../src/controller'

describe('connection drag controller', () => {
  const pending = {
    mode: 'create' as const,
    sourceNodeId: asNodeId('source'),
    sourceSide: 'right' as const,
    pointerId: 7,
    startWorld: { x: 10, y: 10 },
  }

  it('keeps a click pending until movement crosses the screen threshold', () => {
    expect(
      advanceConnectionDrag({
        pending,
        active: null,
        pointerId: 7,
        pointerWorld: { x: 12, y: 10 },
        candidateNodeId: null,
        candidateAnchor: null,
        zoom: 2,
        threshold: 6,
      }),
    ).toEqual({ pending, active: null })
  })

  it('promotes pending input to an active typed drag', () => {
    const result = advanceConnectionDrag({
      pending,
      active: null,
      pointerId: 7,
      pointerWorld: { x: 14, y: 10 },
      candidateNodeId: asNodeId('target'),
      candidateAnchor: { side: 'left', offset: 0.25 },
      zoom: 2,
      threshold: 6,
    })

    expect(result.pending).toBeNull()
    expect(result.active).toMatchObject({
      mode: 'create',
      sourceNodeId: asNodeId('source'),
      candidateNodeId: asNodeId('target'),
      candidateAnchor: { side: 'left', offset: 0.25 },
    })
  })

  it('ignores events from a different pointer', () => {
    expect(
      advanceConnectionDrag({
        pending,
        active: null,
        pointerId: 8,
        pointerWorld: { x: 100, y: 100 },
        candidateNodeId: null,
        candidateAnchor: null,
        zoom: 1,
        threshold: 6,
      }),
    ).toEqual({ pending, active: null })
  })
})
