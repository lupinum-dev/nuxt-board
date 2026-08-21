import { describe, expect, it, vi } from 'vitest'
import { createTouchSession } from '../src/composables/touch-session.js'

function createHarness() {
  const actions = {
    dragThreshold: 6,
    start: vi.fn(() => true),
    update: vi.fn(),
    flush: vi.fn(),
    cancelQueued: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    clearSelection: vi.fn(),
    updatePinch: vi.fn(),
  }
  return { actions, session: createTouchSession(actions) }
}

describe('touch session', () => {
  it('keeps a canvas tap pending and clears selection on lift', () => {
    const { actions, session } = createHarness()

    session.pointerDown(1, { x: 10, y: 10 }, { kind: 'pan' })
    session.pointerMove(1, { x: 13, y: 12 })
    expect(actions.start).not.toHaveBeenCalled()

    session.pointerUp(1)
    expect(actions.clearSelection).toHaveBeenCalledOnce()
    expect(session.getState()).toEqual({ kind: 'idle' })
  })

  it.each(['pan', 'drag', 'resize'] as const)(
    'starts and completes a %s after the movement threshold',
    (kind) => {
      const { actions, session } = createHarness()
      const intent =
        kind === 'pan'
          ? { kind }
          : kind === 'drag'
            ? { kind, nodeId: 'node' }
            : { kind, nodeId: 'node', handle: 'se' as const }

      session.pointerDown(1, { x: 10, y: 10 }, intent)
      session.pointerMove(1, { x: 20, y: 10 })
      session.pointerUp(1)

      expect(actions.start).toHaveBeenCalledWith(intent, 1, { x: 10, y: 10 })
      expect(actions.update).toHaveBeenCalledWith(1, { x: 20, y: 10 })
      expect(actions.flush).toHaveBeenCalledOnce()
      expect(actions.end).toHaveBeenCalledWith(1)
      expect(session.getState()).toEqual({ kind: 'idle' })
    },
  )

  it.each(['drag', 'resize'] as const)(
    'cancels an active %s when a second finger takes over',
    (kind) => {
      const { actions, session } = createHarness()
      const intent =
        kind === 'drag'
          ? { kind, nodeId: 'node' }
          : { kind, nodeId: 'node', handle: 'se' as const }

      session.pointerDown(1, { x: 10, y: 10 }, intent)
      session.pointerMove(1, { x: 20, y: 10 })
      session.pointerDown(2, { x: 40, y: 10 }, { kind: 'pan' })

      expect(actions.cancelQueued).toHaveBeenCalledOnce()
      expect(actions.cancel).toHaveBeenCalledWith(1)
      expect(session.getState().kind).toBe('pinch')
    },
  )

  it('reports midpoint pan and pinch zoom, then returns to idle on either lift', () => {
    const { actions, session } = createHarness()
    session.pointerDown(1, { x: 0, y: 0 }, { kind: 'pan' })
    session.pointerDown(2, { x: 10, y: 0 }, { kind: 'pan' })
    session.pointerMove(2, { x: 20, y: 10 })

    expect(actions.updatePinch).toHaveBeenCalledWith(
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      expect.any(Number),
    )
    session.pointerUp(1)
    expect(actions.end).toHaveBeenCalledWith()
    expect(session.getState()).toEqual({ kind: 'idle' })

    session.pointerUp(2)
    expect(session.getState()).toEqual({ kind: 'idle' })
  })

  it('cancels queued work and always returns to idle', () => {
    const { actions, session } = createHarness()
    session.pointerDown(1, { x: 0, y: 0 }, { kind: 'drag', nodeId: 'node' })
    session.pointerMove(1, { x: 10, y: 0 })

    session.pointerCancel(1)

    expect(actions.cancelQueued).toHaveBeenCalledOnce()
    expect(actions.cancel).toHaveBeenCalledWith(1)
    expect(actions.end).not.toHaveBeenCalled()
    expect(session.getState()).toEqual({ kind: 'idle' })
  })
})
