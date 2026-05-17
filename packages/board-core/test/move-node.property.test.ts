import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createBoardEngine } from '../src'

const finiteInt = (min: number, max: number) => fc.integer({ min, max })
const moveDelta = fc.record({
  dx: finiteInt(-200, 200),
  dy: finiteInt(-200, 200),
})

const buildEngineWithNodes = (count: number) => {
  const engine = createBoardEngine({ grid: { snap: false } })
  const ids: ReturnType<typeof engine.createNode>[] = []
  for (let i = 0; i < count; i++) {
    ids.push(
      engine.createNode({ type: 'text', x: i * 50, y: i * 30, data: {} }),
    )
  }
  return { engine, ids }
}

describe('moveNode invariants', () => {
  it('preserves total node count under any move sequence', () => {
    fc.assert(
      fc.property(
        fc.array(moveDelta, { minLength: 1, maxLength: 30 }),
        (deltas) => {
          const { engine, ids } = buildEngineWithNodes(3)
          const before = engine.getSnapshot().nodes.length
          for (const { dx, dy } of deltas) engine.moveNode(ids[0]!.id, dx, dy)
          expect(engine.getSnapshot().nodes.length).toBe(before)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('cumulative position equals the sum of deltas (no snap, no reparent)', () => {
    fc.assert(
      fc.property(
        fc.array(moveDelta, { minLength: 1, maxLength: 30 }),
        (deltas) => {
          const { engine, ids } = buildEngineWithNodes(1)
          const node = ids[0]!
          const startX = node.x
          const startY = node.y
          for (const { dx, dy } of deltas) engine.moveNode(node.id, dx, dy)
          const sumX = deltas.reduce((acc, d) => acc + d.dx, 0)
          const sumY = deltas.reduce((acc, d) => acc + d.dy, 0)
          const final = engine.getNode(node.id)
          expect(final.x).toBe(startX + sumX)
          expect(final.y).toBe(startY + sumY)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('moving a node never affects other nodes (no group, no parent)', () => {
    fc.assert(
      fc.property(
        fc.array(moveDelta, { minLength: 1, maxLength: 20 }),
        (deltas) => {
          const { engine, ids } = buildEngineWithNodes(3)
          const others = [ids[1]!, ids[2]!].map((n) => ({
            id: n.id,
            x: n.x,
            y: n.y,
          }))
          for (const { dx, dy } of deltas) engine.moveNode(ids[0]!.id, dx, dy)
          for (const o of others) {
            const after = engine.getNode(o.id)
            expect(after.x).toBe(o.x)
            expect(after.y).toBe(o.y)
          }
        },
      ),
      { numRuns: 50 },
    )
  })

  it('moveNode emits exactly one node:moved event per call', () => {
    fc.assert(
      fc.property(
        fc.array(moveDelta, { minLength: 1, maxLength: 10 }),
        (deltas) => {
          const { engine, ids } = buildEngineWithNodes(1)
          let emitted = 0
          const off = engine.on('node:moved', () => {
            emitted++
          })
          for (const { dx, dy } of deltas) engine.moveNode(ids[0]!.id, dx, dy)
          off()
          expect(emitted).toBe(deltas.length)
        },
      ),
      { numRuns: 30 },
    )
  })
})
