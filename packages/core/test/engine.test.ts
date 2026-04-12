import { describe, expect, it } from 'vitest'
import { createCanvasEngine, type CanvasPlugin } from '../src'

describe('canvas engine', () => {
  it('keeps zoom anchored to the cursor', () => {
    const engine = createCanvasEngine()
    const point = { x: 320, y: 240 }
    const before = engine.screenToWorld(point)

    engine.zoomAt(point, -6)

    expect(engine.screenToWorld(point)).toEqual(before)
  })

  it('moves all selected nodes during a drag', () => {
    const engine = createCanvasEngine()
    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 100, y: 50, data: { content: 'B' } })
    engine.select([first.id, second.id])

    engine.beginNodeDrag(first.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 20 })
    engine.endInteraction(1)

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes.find((node) => node.id === first.id)).toMatchObject({ x: 50, y: 20 })
    expect(snapshot.nodes.find((node) => node.id === second.id)).toMatchObject({ x: 150, y: 70 })
  })

  it('supports box selection in screen space', () => {
    const engine = createCanvasEngine()
    const first = engine.createNode({ type: 'text', x: 20, y: 20, width: 80, height: 60, data: { content: 'A' } })
    engine.createNode({ type: 'text', x: 420, y: 320, width: 80, height: 60, data: { content: 'B' } })

    engine.beginBoxSelect(1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 200, y: 160 })
    engine.endInteraction(1)

    expect(engine.getSelection()).toEqual([first.id])
  })

  it('prevents locked nodes from moving, resizing, and deleting', () => {
    const engine = createCanvasEngine()
    const locked = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 100,
      locked: true,
      data: { content: 'Locked' }
    })

    expect(engine.moveNode(locked.id, 40, 20)).toMatchObject({ x: 20, y: 20 })
    expect(engine.resizeNode(locked.id, 'se', 80, 40)).toMatchObject({ width: 120, height: 100 })

    engine.select(locked.id)
    engine.deleteSelected()

    expect(engine.getSnapshot().nodes).toHaveLength(1)
  })

  it('fires command hooks and installs plugins only once per name', () => {
    const events: string[] = []
    let installs = 0
    const plugin: CanvasPlugin = {
      name: 'audit',
      install(engine) {
        installs += 1
        const before = engine.on('command:before', (name) => {
          events.push(`before:${name}`)
        })
        const after = engine.on('command:after', (name) => {
          events.push(`after:${name}`)
        })
        return () => {
          before()
          after()
        }
      }
    }

    const engine = createCanvasEngine({ plugins: [plugin] })
    engine.use(plugin)
    engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Hello' } })

    expect(installs).toBe(1)
    expect(events).toContain('before:createNode')
    expect(events).toContain('after:createNode')
  })

  it('fits nodes into the viewport', async () => {
    const engine = createCanvasEngine()
    engine.setViewportSize({ x: 640, y: 480 })
    const first = engine.createNode({ type: 'text', x: 0, y: 0, width: 120, height: 80, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 1200, y: 900, width: 120, height: 80, data: { content: 'B' } })

    await engine.zoomToFit(40, false)

    const visible = engine.getVisibleBounds(640, 480)
    expect(visible.minX).toBeLessThanOrEqual(first.x)
    expect(visible.maxX).toBeGreaterThanOrEqual(second.x + second.width)
    expect(visible.minY).toBeLessThanOrEqual(first.y)
    expect(visible.maxY).toBeGreaterThanOrEqual(second.y + second.height)
  })
})
