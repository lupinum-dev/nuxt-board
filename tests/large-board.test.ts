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

    expect(engine.getState().nodes.size).toBe(2_000)
    expect(engine.plugins.connections.getEdges()).toHaveLength(200)

    for (let step = 0; step < 60; step += 1) {
      engine.panBy(step % 2 === 0 ? 18 : -12, 10)
      engine.zoomAt({ x: 480, y: 320 }, step % 2 === 0 ? -0.55 : 0.4)
    }
    const camera = engine.getState().camera
    expect(Number.isFinite(camera.x)).toBe(true)
    expect(Number.isFinite(camera.y)).toBe(true)
    expect(Number.isFinite(camera.z)).toBe(true)
    expect(camera).not.toEqual({ x: 0, y: 0, z: 1 })
  })

  it.each([2_000, 10_000])(
    'projects and cancels a drag on a $count-node board',
    (count) => {
      const engine = createBoardEngine({
        grid: { snap: false, edgeSnap: true },
      })
      let dragged!: BoardNode
      engine.batch(() => {
        for (let index = 0; index < count; index += 1) {
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
      for (let step = 1; step <= 20; step += 1) {
        interaction.updatePointer(1, { x: step * 4, y: step * 2 })
      }
      expect(engine.$nodes.get().get(dragged.id)).toMatchObject({
        x: 80,
        y: 40,
      })
      interaction.cancelInteraction(1)
      expect(engine.$nodes.get().get(dragged.id)).toMatchObject({ x: 0, y: 0 })
    },
    15_000,
  )

  it.each([2_000, 10_000])(
    'projects and cancels a resize on a $count-node board',
    (count) => {
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
      for (let step = 1; step <= 20; step += 1) {
        interaction.updatePointer(1, {
          x: 160 + step * 3,
          y: 100 + step * 2,
        })
      }
      expect(engine.$nodes.get().get(resized.id)).toMatchObject({
        width: resized.width + 60,
        height: resized.height + 40,
      })
      interaction.cancelInteraction(1)
      expect(engine.$nodes.get().get(resized.id)).toMatchObject({
        width: resized.width,
        height: resized.height,
      })
    },
    15_000,
  )

  it('builds 10,000 persisted edges in one batch', () => {
    const engine = createBoardEngine({ plugins: [connectionsPlugin()] })
    const a = engine.createNode({ type: 'text', select: false })
    const b = engine.createNode({ type: 'text', x: 300, select: false })
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
  }, 10_000)

  it('resolves 1,000 relevant edge routes', () => {
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

    const visible = getVisibleEdges(engine, {
      minX: -1_000,
      minY: -1_000,
      maxX: 20_000,
      maxY: 20_000,
    })
    expect(visible).toHaveLength(1_000)
  })
})
