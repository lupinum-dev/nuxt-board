import { describe, expect, it } from 'vitest'
import { applyResizeDelta, applyResizeDeltaLocked, snapResizedBounds, snapResizedBoundsLocked } from '../src/resize'
import { createCanvasEngine } from '../src'

// ─── helpers ──────────────────────────────────────────────────────────────────

const CONSTRAINTS = { minWidth: 50, minHeight: 50 }

/** Returns the aspect ratio of an object that has width and height. */
function ratio(b: { width: number; height: number }): number {
  return b.width / b.height
}

// Round to avoid floating-point noise in assertions
function round(b: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.round(b.x * 1e6) / 1e6,
    y: Math.round(b.y * 1e6) / 1e6,
    width: Math.round(b.width * 1e6) / 1e6,
    height: Math.round(b.height * 1e6) / 1e6
  }
}

const NODE_200_100 = { x: 100, y: 100, width: 200, height: 100 } // ratio = 2

// ─── applyResizeDeltaLocked ───────────────────────────────────────────────────

describe('applyResizeDeltaLocked', () => {
  // ── SE corner ──────────────────────────────────────────────────────────────

  it('SE: grows proportionally when width delta is dominant', () => {
    // growX / w = 40/200 = 0.20, growY / h = 10/100 = 0.10 → width dominant
    const result = applyResizeDeltaLocked(NODE_200_100, 'se', 40, 10, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)  // 240 / 2
    expect(result.x).toBe(100)       // origin unchanged for SE
    expect(result.y).toBe(100)
  })

  it('SE: grows proportionally when height delta is dominant', () => {
    // growX / w = 10/200 = 0.05, growY / h = 40/100 = 0.40 → height dominant
    const result = applyResizeDeltaLocked(NODE_200_100, 'se', 10, 40, CONSTRAINTS, 2)
    expect(result.height).toBe(140)
    expect(result.width).toBe(280)   // 140 * 2
  })

  it('SE: shrinks proportionally', () => {
    const result = applyResizeDeltaLocked(NODE_200_100, 'se', -40, -20, CONSTRAINTS, 2)
    // growX / w = 40/200 = 0.20, growY / h = 20/100 = 0.20 → equal, width branch wins
    expect(result.width).toBe(160)
    expect(result.height).toBe(80)
  })

  // ── NW corner ──────────────────────────────────────────────────────────────

  it('NW: shrinks from top-left, moving origin proportionally', () => {
    // Moving right+down (NW shrink): deltaX=30, deltaY=20
    // growX = -(-30)? No: NW handle: xSign=-1, ySign=-1
    // growX = xSign*deltaX = -1*30 = -30 (shrinking), growY = -1*20 = -20 (shrinking)
    // |growX/w|=0.15, |growY/h|=0.20 → height dominant
    // newH = max(50, 100+(-20)) = 80, newW = 80*2 = 160
    // cdx = xSign*(newW-w) = -1*(160-200) = 40  (positive means move right)
    // cdy = ySign*(newH-h) = -1*(80-100) = 20   (positive means move down)
    // applyResizeDelta(node, 'nw', 40, 20): nextWidth=max(50,200-40)=160, x=100+40=140
    //                                       nextHeight=max(50,100-20)=80,  y=100+20=120
    const result = applyResizeDeltaLocked(NODE_200_100, 'nw', 30, 20, CONSTRAINTS, 2)
    expect(result.width).toBe(160)
    expect(result.height).toBe(80)
    expect(result.x).toBe(140)
    expect(result.y).toBe(120)
    expect(ratio(result)).toBeCloseTo(2, 5)
  })

  it('NW: grows from top-left, moving origin proportionally', () => {
    // Moving left+up: deltaX=-40, deltaY=-10
    // growX = -1*(-40) = 40 (growing), growY = -1*(-10) = 10 (growing)
    // |growX/w|=0.20, |growY/h|=0.10 → width dominant
    // newW = 200+40 = 240, newH = 240/2 = 120
    // cdx = -1*(240-200) = -40, cdy = -1*(120-100) = -20
    // applyResizeDelta('nw', -40, -20): nextWidth=max(50,200-(-40))=240, x=100-40=60
    //                                   nextHeight=max(50,100-(-20))=120, y=100-20=80
    const result = applyResizeDeltaLocked(NODE_200_100, 'nw', -40, -10, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(60)
    expect(result.y).toBe(80)
  })

  // ── NE corner ──────────────────────────────────────────────────────────────

  it('NE: grows right and up proportionally', () => {
    // deltaX=40 (right), deltaY=-20 (up)
    // xSign=1, ySign=-1: growX=40, growY=-1*(-20)=20
    // |growX/w|=0.20, |growY/h|=0.20 → equal, width branch wins
    // newW=240, newH=120; cdx=40, cdy=-1*(120-100)=-20
    // x unchanged, y moves up
    const result = applyResizeDeltaLocked(NODE_200_100, 'ne', 40, -20, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(100)
    expect(result.y).toBe(80)   // moved up by 20
  })

  // ── SW corner ──────────────────────────────────────────────────────────────

  it('SW: grows left and down proportionally', () => {
    // deltaX=-40 (left), deltaY=20 (down)
    // xSign=-1, ySign=1: growX=-1*(-40)=40, growY=20
    // |growX/w|=0.20, |growY/h|=0.20 → equal, width wins
    // newW=240, newH=120; cdx=-1*(240-200)=-40, cdy=1*(120-100)=20
    // applyResizeDelta('sw', -40, 20): w: nextWidth=max(50,200-(-40))=240, x=100-40=60; s: height=120
    const result = applyResizeDeltaLocked(NODE_200_100, 'sw', -40, 20, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(60)
    expect(result.y).toBe(100)   // y unchanged for SW
  })

  // ── E edge ─────────────────────────────────────────────────────────────────

  it('E: extends right and derives height from ratio (growing south)', () => {
    const result = applyResizeDeltaLocked(NODE_200_100, 'e', 40, 0, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  it('E: shrinks right and shrinks height from ratio', () => {
    const result = applyResizeDeltaLocked(NODE_200_100, 'e', -60, 0, CONSTRAINTS, 2)
    expect(result.width).toBe(140)
    expect(result.height).toBe(70)
  })

  // ── W edge ─────────────────────────────────────────────────────────────────

  it('W: extends left, x moves left, height adjusts from ratio', () => {
    // deltaX=-40 means moved left → width grows: newW = max(50, 200-(-40)) = 240
    const result = applyResizeDeltaLocked(NODE_200_100, 'w', -40, 0, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(60)    // moved left
    expect(result.y).toBe(100)
  })

  // ── S edge ─────────────────────────────────────────────────────────────────

  it('S: extends down, derives width from ratio (growing east)', () => {
    const result = applyResizeDeltaLocked(NODE_200_100, 's', 0, 30, CONSTRAINTS, 2)
    expect(result.height).toBe(130)
    expect(result.width).toBe(260)
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  // ── N edge ─────────────────────────────────────────────────────────────────

  it('N: extends up, y moves up, derives width from ratio (growing east)', () => {
    // deltaY=-30 means moved up → height grows: newH = max(50, 100-(-30)) = 130
    const result = applyResizeDeltaLocked(NODE_200_100, 'n', 0, -30, CONSTRAINTS, 2)
    expect(result.height).toBe(130)
    expect(result.width).toBe(260)
    expect(result.y).toBe(70)    // moved up by 30
    expect(result.x).toBe(100)
  })

  // ── Constraints ────────────────────────────────────────────────────────────

  it('SE: clamps to minWidth when shrinking below minimum', () => {
    // Shrink far past minimum
    const result = applyResizeDeltaLocked(NODE_200_100, 'se', -300, -300, CONSTRAINTS, 2)
    expect(result.width).toBeGreaterThanOrEqual(CONSTRAINTS.minWidth)
    expect(result.height).toBeGreaterThanOrEqual(CONSTRAINTS.minHeight)
  })

  it('NW: clamps to minHeight and adjusts ratio accordingly', () => {
    const result = applyResizeDeltaLocked(NODE_200_100, 'nw', 300, 300, CONSTRAINTS, 2)
    expect(result.width).toBeGreaterThanOrEqual(CONSTRAINTS.minWidth)
    expect(result.height).toBeGreaterThanOrEqual(CONSTRAINTS.minHeight)
  })

  it('preserves ratio exactly on all corner handles when unconstrained', () => {
    const handles = ['se', 'sw', 'ne', 'nw'] as const
    for (const handle of handles) {
      const dx = handle.includes('e') ? 30 : -30
      const dy = handle.includes('s') ? 20 : -20
      const result = applyResizeDeltaLocked(NODE_200_100, handle, dx, dy, CONSTRAINTS, 2)
      expect(ratio(result)).toBeCloseTo(2, 5)
    }
  })

  it('preserves ratio exactly on all edge handles when unconstrained', () => {
    const handles = ['e', 'w', 's', 'n'] as const
    for (const handle of handles) {
      const dx = handle === 'e' ? 40 : handle === 'w' ? -40 : 0
      const dy = handle === 's' ? 30 : handle === 'n' ? -30 : 0
      const result = applyResizeDeltaLocked(NODE_200_100, handle, dx, dy, CONSTRAINTS, 2)
      expect(ratio(result)).toBeCloseTo(2, 5)
    }
  })

  it('handles non-integer aspect ratios (e.g. 16:9)', () => {
    const node = { x: 0, y: 0, width: 160, height: 90 }
    const ar = 160 / 90 // ≈ 1.778
    const result = round(applyResizeDeltaLocked(node, 'se', 32, 0, CONSTRAINTS, ar))
    expect(result.width).toBe(192)
    expect(result.height).toBeCloseTo(108, 4)
    expect(ratio(result)).toBeCloseTo(ar, 5)
  })
})

// ─── snapResizedBoundsLocked ──────────────────────────────────────────────────

describe('snapResizedBoundsLocked', () => {
  const GRID = 20
  const START = { x: 100, y: 100, width: 200, height: 100 } // ratio = 2

  it('SE: snaps width to grid and derives height from ratio', () => {
    // raw from aspect-ratio locked: 240×120
    const raw = { x: 100, y: 100, width: 237, height: 118.5 }
    const result = snapResizedBoundsLocked(raw, START, 'se', GRID, CONSTRAINTS, 2)
    expect(result.width).toBe(240)            // snapped up to nearest 20
    expect(result.height).toBe(120)           // 240 / 2
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  it('NW: snaps width to grid, keeps right+bottom edges fixed', () => {
    // right = 100+200=300, bottom=100+100=200
    const raw = { x: 58, y: 79, width: 242, height: 121 }
    const result = snapResizedBoundsLocked(raw, START, 'nw', GRID, CONSTRAINTS, 2)
    expect(result.width).toBe(240)             // snapped to 240
    expect(result.height).toBe(120)            // 240 / 2
    expect(result.x).toBe(60)                  // right - snappedW = 300 - 240
    expect(result.y).toBe(80)                  // bottom - snappedH = 200 - 120
  })

  it('NE: snaps width to grid, y derived from snapped height', () => {
    // right edge free (E), top edge moves (N)
    // bottom = 100+100 = 200
    const raw = { x: 100, y: 78, width: 243, height: 122 }
    const result = snapResizedBoundsLocked(raw, START, 'ne', GRID, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(100)
    expect(result.y).toBe(80)                  // 200 - 120
  })

  it('SW: snaps width, x derived from right edge', () => {
    // right = 300
    const raw = { x: 58, y: 100, width: 242, height: 121 }
    const result = snapResizedBoundsLocked(raw, START, 'sw', GRID, CONSTRAINTS, 2)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
    expect(result.x).toBe(60)                  // 300 - 240
    expect(result.y).toBe(100)
  })

  it('N: height is primary, snaps height and derives width', () => {
    const raw = { x: 100, y: 72, width: 256, height: 128 }
    const result = snapResizedBoundsLocked(raw, START, 'n', GRID, CONSTRAINTS, 2)
    expect(result.height).toBe(120)            // snapped down
    expect(result.width).toBe(240)             // 120 * 2
    expect(result.y).toBe(80)                  // bottom - snappedH = 200 - 120
  })

  it('S: height is primary, snaps height and derives width', () => {
    const raw = { x: 100, y: 100, width: 263, height: 131 }
    const result = snapResizedBoundsLocked(raw, START, 's', GRID, CONSTRAINTS, 2)
    expect(result.height).toBe(140)            // snapped to nearest 20
    expect(result.width).toBe(280)             // 140 * 2
    expect(result.y).toBe(100)
  })

  it('respects minWidth constraint after snapping', () => {
    const raw = { x: 140, y: 115, width: 60, height: 30 }
    const result = snapResizedBoundsLocked(raw, START, 'se', GRID, CONSTRAINTS, 2)
    expect(result.width).toBeGreaterThanOrEqual(CONSTRAINTS.minWidth)
    expect(result.height).toBeGreaterThanOrEqual(CONSTRAINTS.minHeight)
  })

  it('preserves exact ratio after snap when dimensions are already on grid', () => {
    const raw = { x: 100, y: 100, width: 240, height: 120 }
    const result = snapResizedBoundsLocked(raw, START, 'se', GRID, CONSTRAINTS, 2)
    expect(ratio(result)).toBeCloseTo(2, 5)
  })
})

// ─── Integration via engine ───────────────────────────────────────────────────

describe('aspect-ratio resize via engine (Shift key)', () => {
  it('preserves aspect ratio when shift is held during SE resize', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, width: 200, height: 100, data: {} })

    engine.beginResize(node.id, 'se', 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 60, y: 10 }, { shift: true })
    engine.endInteraction(1)

    const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
    expect(ratio(result)).toBeCloseTo(2, 5)
    expect(result.width).toBe(260)
    expect(result.height).toBe(130)
  })

  it('preserves aspect ratio when shift is held during NW resize', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 100, y: 100, width: 200, height: 100, data: {} })

    engine.beginResize(node.id, 'nw', 1, { x: 100, y: 100 })
    // Move left and up: shrink both axes
    engine.updatePointer(1, { x: 140, y: 115 }, { shift: true })
    engine.endInteraction(1)

    const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
    expect(ratio(result)).toBeCloseTo(2, 5)
  })

  it('does NOT constrain aspect ratio when shift is not held', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, width: 200, height: 100, data: {} })

    engine.beginResize(node.id, 'se', 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 40, y: 70 }, { shift: false })
    engine.endInteraction(1)

    const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
    // Free resize: width=240, height=170 — ratio broken
    expect(result.width).toBe(240)
    expect(result.height).toBe(170)
    expect(ratio(result)).not.toBeCloseTo(2, 0)
  })

  it('switching shift on/off mid-resize produces correct result at release', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, width: 200, height: 100, data: {} })

    engine.beginResize(node.id, 'se', 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 90 }, { shift: false }) // free resize
    engine.updatePointer(1, { x: 50, y: 90 }, { shift: true })  // lock applied at last move
    engine.endInteraction(1)

    const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
    expect(ratio(result)).toBeCloseTo(2, 5)
  })

  it('stores aspectRatio in interaction state at beginResize', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, width: 300, height: 200, data: {} })

    engine.beginResize(node.id, 'se', 1, { x: 0, y: 0 })

    const interaction = engine.getSnapshot().interaction
    expect(interaction.mode).toBe('resizing-node')
    if (interaction.mode === 'resizing-node') {
      expect(interaction.aspectRatio).toBeCloseTo(1.5, 5)
    }
  })

  it('preserves ratio with snap enabled', () => {
    const engine = createCanvasEngine({ grid: { size: 20, snap: true } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, width: 200, height: 100, data: {} })

    engine.beginResize(node.id, 'se', 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 55, y: 10 }, { shift: true })
    engine.endInteraction(1)

    const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
    // Width should be on the 20-grid
    expect(result.width % 20).toBe(0)
    expect(ratio(result)).toBeCloseTo(2, 5)
  })

  it('all eight handles preserve ratio under shift', () => {
    const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
    const deltas: Record<string, { x: number; y: number }> = {
      n:  { x: 0,   y: -30 },
      ne: { x: 30,  y: -20 },
      e:  { x: 40,  y: 0 },
      se: { x: 40,  y: 20 },
      s:  { x: 0,   y: 30 },
      sw: { x: -40, y: 20 },
      w:  { x: -40, y: 0 },
      nw: { x: -30, y: -20 }
    }

    for (const handle of handles) {
      const engine = createCanvasEngine({ grid: { snap: false } })
      const node = engine.createNode({ type: 'text', x: 100, y: 100, width: 200, height: 100, data: {} })
      const d = deltas[handle]!

      engine.beginResize(node.id, handle, 1, { x: 0, y: 0 })
      engine.updatePointer(1, d, { shift: true })
      engine.endInteraction(1)

      const result = engine.getSnapshot().nodes.find((n) => n.id === node.id)!
      expect(ratio(result)).toBeCloseTo(2, 4)
    }
  })
})

// ─── Existing applyResizeDelta tests (regression) ────────────────────���───────

describe('applyResizeDelta (regression)', () => {
  it('SE: extends right and down, origin unchanged', () => {
    const result = applyResizeDelta(NODE_200_100, 'se', 40, 20, CONSTRAINTS)
    expect(result).toMatchObject({ x: 100, y: 100, width: 240, height: 120 })
  })

  it('NW: shrinks from top-left, origin moves', () => {
    const result = applyResizeDelta(NODE_200_100, 'nw', 30, 40, CONSTRAINTS)
    expect(result.x).toBe(130)
    expect(result.y).toBe(140)
    expect(result.width).toBe(170)
    expect(result.height).toBe(60)
  })

  it('enforces minimum width and height', () => {
    const result = applyResizeDelta(NODE_200_100, 'se', -500, -500, CONSTRAINTS)
    expect(result.width).toBe(CONSTRAINTS.minWidth)
    expect(result.height).toBe(CONSTRAINTS.minHeight)
  })
})

// ─── snapResizedBounds (regression) ──────────────────────────────────────────

describe('snapResizedBounds (regression)', () => {
  it('SE: snaps width and height independently', () => {
    const raw = { x: 100, y: 100, width: 237, height: 118 }
    const result = snapResizedBounds(raw, 'se', 20, CONSTRAINTS)
    expect(result.width).toBe(240)
    expect(result.height).toBe(120)
  })

  it('NW: snaps x and y, keeping opposite corner fixed', () => {
    // right=300, bottom=200; raw after shrink
    const raw = { x: 62, y: 82, width: 238, height: 118 }
    const result = snapResizedBounds(raw, 'nw', 20, CONSTRAINTS)
    // x should snap toward 60, right stays near 300
    expect(result.x % 20).toBe(0)
    expect(result.y % 20).toBe(0)
  })
})
