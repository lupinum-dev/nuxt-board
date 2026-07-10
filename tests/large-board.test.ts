import { describe, expect, it } from 'vitest'
import {
  asEdgeId,
  createBoardEngine,
  type BoardNode,
} from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'
import { connectionsPlugin, getVisibleEdges } from '@lupinum/board-connections'

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

  it('keeps transient drag projection within the 2,000-node frame budget', () => {
    const engine = createBoardEngine({ grid: { snap: false, edgeSnap: true } })
    let dragged!: BoardNode
    engine.batch(() => {
      for (let index = 0; index < 2_000; index += 1) {
        const node = engine.createNode({
          type: 'text',
          x: (index % 50) * 180,
          y: Math.floor(index / 50) * 120,
          select: false,
        })
        if (index === 0) dragged = node
      }
    })

    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(dragged.id, 1, { x: 0, y: 0 })
    const samples: number[] = []
    for (let step = 1; step <= 30; step += 1) {
      const started = performance.now()
      interaction.updatePointer(1, { x: step * 4, y: step * 2 })
      samples.push(performance.now() - started)
    }
    interaction.cancelInteraction(1)

    samples.sort((a, b) => a - b)
    const p95 = samples[Math.floor(samples.length * 0.95)]!
    expect(p95).toBeLessThan(16.7)
  })

  it('keeps transient drag projection within the 10,000-node budget', () => {
    const engine = createBoardEngine({ grid: { snap: false, edgeSnap: true } })
    let dragged!: BoardNode
    engine.batch(() => {
      for (let index = 0; index < 10_000; index += 1) {
        const node = engine.createNode({
          type: 'text',
          x: (index % 100) * 180,
          y: Math.floor(index / 100) * 120,
          select: false,
        })
        if (index === 0) dragged = node
      }
    })

    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(dragged.id, 1, { x: 0, y: 0 })
    const samples: number[] = []
    for (let step = 1; step <= 20; step += 1) {
      const started = performance.now()
      interaction.updatePointer(1, { x: step * 4, y: step * 2 })
      samples.push(performance.now() - started)
    }
    interaction.cancelInteraction(1)

    samples.sort((a, b) => a - b)
    const p95 = samples[Math.floor(samples.length * 0.95)]!
    expect(p95).toBeLessThan(50)
  }, 15_000)

  it.each([
    { count: 2_000, budget: 16.7 },
    { count: 10_000, budget: 50 },
  ])(
    'keeps transient resize projection within the $count-node budget',
    ({ count, budget }) => {
      const engine = createBoardEngine({
        grid: { snap: false, edgeSnap: true },
      })
      let resized!: BoardNode
      engine.batch(() => {
        for (let index = 0; index < count; index += 1) {
          const node = engine.createNode({
            type: 'text',
            x: (index % 100) * 180,
            y: Math.floor(index / 100) * 120,
            select: false,
          })
          if (index === 0) resized = node
        }
      })

      const interaction = getBoardInteractionAdapter(engine)
      interaction.beginResize(resized.id, 'se', 1, { x: 160, y: 100 })
      const samples: number[] = []
      for (let step = 1; step <= 20; step += 1) {
        const started = performance.now()
        interaction.updatePointer(1, {
          x: 160 + step * 3,
          y: 100 + step * 2,
        })
        samples.push(performance.now() - started)
      }
      interaction.cancelInteraction(1)

      samples.sort((a, b) => a - b)
      const p95 = samples[Math.floor(samples.length * 0.95)]!
      expect(p95).toBeLessThan(budget)
    },
    15_000,
  )

  it('builds 10,000 persisted edges without quadratic batch cloning', () => {
    const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
    const a = engine.createNode({ type: 'text', select: false })
    const b = engine.createNode({ type: 'text', x: 300, select: false })
    const started = performance.now()

    engine.batch(() => {
      for (let index = 0; index < 10_000; index += 1) {
        engine.plugins.connections.createEdge({
          id: asEdgeId(`edge-${index}`),
          from: a.id,
          to: b.id,
          data: {},
        })
      }
    })

    expect(engine.plugins.connections.getEdges()).toHaveLength(10_000)
    expect(performance.now() - started).toBeLessThan(5_000)
  }, 10_000)

  it('resolves 1,000 relevant edge routes within the headless budget', () => {
    const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
    const nodes: BoardNode[] = []
    engine.batch(() => {
      for (let index = 0; index <= 1_000; index += 1) {
        nodes.push(
          engine.createNode({
            type: 'text',
            x: (index % 50) * 180,
            y: Math.floor(index / 50) * 120,
            select: false,
          }),
        )
      }
      for (let index = 0; index < 1_000; index += 1) {
        engine.plugins.connections.createEdge({
          id: asEdgeId(`visible-${index}`),
          from: nodes[index]!.id,
          to: nodes[index + 1]!.id,
          data: {},
        })
      }
    })

    const started = performance.now()
    const visible = getVisibleEdges(engine, {
      minX: -1_000,
      minY: -1_000,
      maxX: 20_000,
      maxY: 20_000,
    })
    expect(visible).toHaveLength(1_000)
    expect(performance.now() - started).toBeLessThan(50)
  })
})
