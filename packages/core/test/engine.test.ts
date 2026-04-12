import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '../src/index'

describe('canvas engine', () => {
  it('keeps zoom anchored to the cursor', () => {
    const engine = createCanvasEngine()
    const point = { x: 320, y: 240 }
    const before = engine.screenToWorld(point)

    engine.zoomAtScreenPoint(point, -6)

    expect(engine.screenToWorld(point)).toEqual(before)
  })

  it('moves nodes in world space during drag even when zoomed', () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ x: 10, y: 20, text: 'A' })

    engine.zoomAtScreenPoint({ x: 0, y: 0 }, -10)
    engine.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 25 })
    engine.endInteraction(1)

    const moved = engine.getSnapshot().nodes.find((entry) => entry.id === node.id)
    expect(moved).toMatchObject({ x: 60, y: 40 })
  })

  it('resizes from north-west handles while preserving the opposite edge', () => {
    const engine = createCanvasEngine({ minNodeWidth: 50, minNodeHeight: 50 })
    const node = engine.createNode({ x: 100, y: 100, width: 200, height: 120 })

    engine.resizeNode(node.id, 'nw', 40, 20)
    let resized = engine.getSnapshot().nodes.find((entry) => entry.id === node.id)
    expect(resized).toMatchObject({ x: 140, y: 120, width: 160, height: 100 })

    engine.resizeNode(node.id, 'nw', 500, 500)
    resized = engine.getSnapshot().nodes.find((entry) => entry.id === node.id)
    expect(resized).toMatchObject({ width: 50, height: 50 })
  })

  it('deletes the current selection and resets interaction state', () => {
    const engine = createCanvasEngine()
    const first = engine.createNode({ text: 'A' })
    const second = engine.createNode({ text: 'B' })

    engine.select([first.id, second.id])
    engine.beginPan(1, { x: 0, y: 0 })
    engine.deleteSelected()

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes).toHaveLength(0)
    expect(snapshot.selection).toHaveLength(0)
    expect(snapshot.interaction.mode).toBe('idle')
  })

  it('grab-panning moves the canvas with the pointer at screen speed', () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ x: 100, y: 80, width: 120, height: 90, text: 'Anchor' })
    const before = engine.worldToScreen({ x: node.x, y: node.y })

    engine.beginPan(1, { x: 200, y: 120 })
    engine.updatePointer(1, { x: 260, y: 155 })
    engine.endInteraction(1)

    const after = engine.worldToScreen({ x: node.x, y: node.y })
    expect(after.x - before.x).toBeCloseTo(60)
    expect(after.y - before.y).toBeCloseTo(35)
  })

  it('snaps created nodes and resized bounds to the fixed grid', () => {
    const engine = createCanvasEngine({ gridSize: 10, majorGridEvery: 5 })
    const created = engine.createNode({
      x: 13,
      y: 27,
      width: 243,
      height: 157
    })

    expect(created).toMatchObject({
      x: 10,
      y: 30,
      width: 240,
      height: 160
    })

    const resized = engine.resizeNode(created.id, 'se', 17, 19)
    expect(resized).toMatchObject({
      x: 10,
      y: 30,
      width: 260,
      height: 180
    })
  })

  it('updates grid settings at runtime', () => {
    const engine = createCanvasEngine()
    const next = engine.updateGridSettings({
      size: 24.2,
      majorEvery: 3.4,
      snap: false
    })

    expect(next).toMatchObject({
      size: 24,
      majorEvery: 3,
      snap: false
    })
    expect(engine.getSnapshot().grid).toMatchObject(next)

    const node = engine.createNode({ x: 13, y: 13, width: 111, height: 111 })
    expect(node).toMatchObject({
      x: 13,
      y: 13,
      width: 111,
      height: 111
    })
  })

  it('throws on invalid selection when strict invariants are enabled', () => {
    const engine = createCanvasEngine()
    expect(() => engine.select('missing-node')).toThrow(/Canvas invariant failed/)
  })

  it('tracks text editing lifecycle', () => {
    const engine = createCanvasEngine()
    const node = engine.createNode({ text: 'draft' })

    engine.beginTextEdit(node.id)
    expect(engine.getSnapshot().interaction).toMatchObject({
      mode: 'editing-text',
      nodeId: node.id
    })

    engine.commitTextEdit(node.id, 'published')
    const updated = engine.getSnapshot().nodes.find((entry) => entry.id === node.id)
    expect(updated?.text).toBe('published')
    expect(engine.getSnapshot().interaction.mode).toBe('idle')
  })
})
