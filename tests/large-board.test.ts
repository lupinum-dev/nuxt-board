import { describe, expect, it } from 'vitest'
import { createBoardEngine, type BoardNode } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'

describe('large board regression', () => {
  it('stages 2,000 nodes and representative edges in one outer transaction', () => {
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
    })
    const nodes: BoardNode[] = []
    const startedAt = performance.now()

    engine.batch(() => {
      for (let index = 0; index < 2_000; index += 1) {
        nodes.push(
          engine.createNode({
            type: 'text',
            x: (index % 45) * 180,
            y: Math.floor(index / 45) * 120,
            width: 160,
            height: 90,
            text: `Node ${index + 1}`,
            select: false,
          }),
        )
      }

      for (let index = 0; index < 200; index += 1) {
        engine.plugins.connections.createEdge({
          from: nodes[index]!.id,
          to: nodes[index + 1]!.id,
          data: {},
        })
      }
    })

    const buildDuration = performance.now() - startedAt
    expect(engine.getState().nodes.size).toBe(2_000)
    expect(engine.plugins.connections.getEdges()).toHaveLength(200)
    expect(buildDuration).toBeLessThan(10_000)

    const cameraStartedAt = performance.now()
    for (let step = 0; step < 60; step += 1) {
      engine.panBy(step % 2 === 0 ? 18 : -12, 10)
      engine.zoomAt({ x: 480, y: 320 }, step % 2 === 0 ? -0.55 : 0.4)
    }
    expect(performance.now() - cameraStartedAt).toBeLessThan(2_000)
  })
})
