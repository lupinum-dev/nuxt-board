import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createBoardEngine, type BoardNode } from '../src'

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
      engine.createNode({ type: 'text', x: i * 50, y: i * 30, text: '' }),
    )
  }
  return { engine, ids }
}

function expectNoParentCycles(nodes: readonly BoardNode[]): void {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    const seen = new Set([node.id])
    let parentId = node.parentId
    while (parentId) {
      expect(seen.has(parentId)).toBe(false)
      seen.add(parentId)
      parentId = byId.get(parentId)?.parentId
    }
  }
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

  it('preserves hierarchy invariants while moving grouped nodes', () => {
    fc.assert(
      fc.property(
        fc.array(moveDelta, { minLength: 1, maxLength: 20 }),
        (deltas) => {
          const engine = createBoardEngine({ grid: { snap: false } })
          const group = engine.createNode({
            type: 'group',
            x: 0,
            y: 0,
            width: 300,
            height: 240,
            select: false,
          })
          const child = engine.createNode({
            type: 'text',
            x: 40,
            y: 40,
            width: 100,
            height: 70,
            text: '',
            parentId: group.id,
            select: false,
          })

          for (const { dx, dy } of deltas) {
            engine.moveNode(group.id, dx, dy)
            engine.moveNode(child.id, -dx / 2, -dy / 2)
            const nodes = engine.getSnapshot().nodes
            expectNoParentCycles(nodes)
            const latestGroup = nodes.find((node) => node.id === group.id)!
            const latestChild = nodes.find((node) => node.id === child.id)!
            if (latestChild.parentId === latestGroup.id) {
              expect(latestChild.zIndex).toBeGreaterThan(latestGroup.zIndex)
            }
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})
