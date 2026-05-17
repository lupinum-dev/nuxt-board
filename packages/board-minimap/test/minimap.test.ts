import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { createBoardEngine } from '@lupinum/board-core'
import { useMinimap } from '../src'

describe('minimap', () => {
  it('projects nodes and viewport into minimap space', () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })

    const scope = effectScope()
    const minimap = scope.run(() =>
      useMinimap(engine, { width: 200, height: 120 }),
    )
    if (!minimap) {
      throw new Error('Minimap scope did not initialize.')
    }

    expect(minimap.minimapNodes.value).toHaveLength(2)
    expect(minimap.viewportRect.value.width).toBeGreaterThan(0)
    scope.stop()
  })

  it('centers the clicked minimap point into the viewport', async () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })

    const scope = effectScope()
    const minimap = scope.run(() =>
      useMinimap(engine, { width: 200, height: 120 }),
    )
    if (!minimap) {
      throw new Error('Minimap scope did not initialize.')
    }

    await minimap.panToMinimapPoint({ x: 100, y: 60 })

    const visible = engine.getVisibleBounds(400, 300)
    const worldAtViewportCenter = {
      x: (visible.minX + visible.maxX) / 2,
      y: (visible.minY + visible.maxY) / 2,
    }

    expect(worldAtViewportCenter.x).toBeCloseTo(350, 0)
    expect(worldAtViewportCenter.y).toBeCloseTo(240, 0)
    scope.stop()
  })

  it('updates the projected viewport when the board viewport size changes', () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })

    const scope = effectScope()
    const minimap = scope.run(() =>
      useMinimap(engine, { width: 200, height: 120 }),
    )
    if (!minimap) {
      throw new Error('Minimap scope did not initialize.')
    }

    const before = minimap.viewportRect.value.width
    engine.setViewportSize({ x: 800, y: 600 })
    const after = minimap.viewportRect.value.width

    expect(after).toBeGreaterThan(before)
    scope.stop()
  })

  it('updates the projected viewport when the camera moves without node changes', () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 400, y: 300 })
    engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 600,
      y: 400,
      width: 100,
      height: 80,
      text: 'Node',
    })

    const scope = effectScope()
    const minimap = scope.run(() =>
      useMinimap(engine, { width: 200, height: 120 }),
    )
    if (!minimap) {
      throw new Error('Minimap scope did not initialize.')
    }

    const before = minimap.viewportRect.value.x
    engine.panBy(120, 0)
    const after = minimap.viewportRect.value.x

    expect(after).not.toBe(before)
    scope.stop()
  })
})
