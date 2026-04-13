import { snapSize, snapValue } from './math'
import type { BoardNode, ResizeHandle } from './types'

export interface ResizeConstraints {
  minWidth: number
  minHeight: number
}

type NodeBounds = Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>

export function applyResizeDelta(
  node: NodeBounds,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  constraints: ResizeConstraints
): NodeBounds {
  let { x, y, width, height } = node

  if (handle.includes('e')) {
    width = Math.max(constraints.minWidth, node.width + deltaX)
  }
  if (handle.includes('s')) {
    height = Math.max(constraints.minHeight, node.height + deltaY)
  }
  if (handle.includes('w')) {
    const nextWidth = Math.max(constraints.minWidth, node.width - deltaX)
    const consumed = node.width - nextWidth
    width = nextWidth
    x = node.x + consumed
  }
  if (handle.includes('n')) {
    const nextHeight = Math.max(constraints.minHeight, node.height - deltaY)
    const consumed = node.height - nextHeight
    height = nextHeight
    y = node.y + consumed
  }

  return { x, y, width, height }
}

export function snapResizedBounds(
  bounds: NodeBounds,
  handle: ResizeHandle,
  gridSize: number,
  constraints: ResizeConstraints
): NodeBounds {
  let { x, y, width, height } = bounds
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height

  if (handle.includes('e')) {
    width = snapSize(width, gridSize, constraints.minWidth)
  } else {
    x = snapValue(x, gridSize)
  }

  if (handle.includes('s')) {
    height = snapSize(height, gridSize, constraints.minHeight)
  } else {
    y = snapValue(y, gridSize)
  }

  if (handle.includes('w')) {
    width = snapSize(width, gridSize, constraints.minWidth)
    x = snapValue(right - width, gridSize)
    width = Math.max(constraints.minWidth, right - x)
  }

  if (handle.includes('n')) {
    height = snapSize(height, gridSize, constraints.minHeight)
    y = snapValue(bottom - height, gridSize)
    height = Math.max(constraints.minHeight, bottom - y)
  }

  return { x, y, width, height }
}

/**
 * Aspect-ratio-locked variant of applyResizeDelta.
 *
 * For corner handles the dominant axis (larger normalised delta) drives the
 * resize and the other axis is computed from `aspectRatio = width / height`.
 * For edge handles the active axis drives and the perpendicular axis is
 * derived, effectively upgrading the handle to its nearest corner.
 */
export function applyResizeDeltaLocked(
  node: NodeBounds,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  constraints: ResizeConstraints,
  aspectRatio: number
): NodeBounds {
  const { width: w, height: h } = node

  let cdx = deltaX
  let cdy = deltaY
  let effectiveHandle: ResizeHandle = handle

  if (handle === 'e') {
    const newW = Math.max(constraints.minWidth, w + deltaX)
    cdx = newW - w
    cdy = Math.max(constraints.minHeight, newW / aspectRatio) - h
    effectiveHandle = 'se'
  } else if (handle === 'w') {
    const newW = Math.max(constraints.minWidth, w - deltaX)
    cdy = Math.max(constraints.minHeight, newW / aspectRatio) - h
    // cdx stays as deltaX — applyResizeDelta(w) uses `w - deltaX` internally
    effectiveHandle = 'sw'
  } else if (handle === 's') {
    const newH = Math.max(constraints.minHeight, h + deltaY)
    cdy = newH - h
    cdx = Math.max(constraints.minWidth, newH * aspectRatio) - w
    effectiveHandle = 'se'
  } else if (handle === 'n') {
    const newH = Math.max(constraints.minHeight, h - deltaY)
    cdx = Math.max(constraints.minWidth, newH * aspectRatio) - w
    // cdy stays as deltaY — applyResizeDelta(n) uses `h - deltaY` internally
    effectiveHandle = 'ne'
  } else {
    // Corner handles — pick the dominant axis (larger normalised growth)
    const xSign = handle.includes('e') ? 1 : -1
    const ySign = handle.includes('s') ? 1 : -1
    const growX = xSign * deltaX // positive → width growing
    const growY = ySign * deltaY // positive → height growing

    let newW: number
    let newH: number
    if (Math.abs(growX / w) >= Math.abs(growY / h)) {
      newW = Math.max(constraints.minWidth, w + growX)
      newH = Math.max(constraints.minHeight, newW / aspectRatio)
    } else {
      newH = Math.max(constraints.minHeight, h + growY)
      newW = Math.max(constraints.minWidth, newH * aspectRatio)
    }

    cdx = xSign * (newW - w)
    cdy = ySign * (newH - h)
  }

  return applyResizeDelta(node, effectiveHandle, cdx, cdy, constraints)
}

/**
 * Aspect-ratio-preserving snap.  Snaps the primary dimension to the grid
 * and derives the secondary exactly from the ratio so the shape stays true.
 *
 * For N / S handles height is primary; for everything else width is primary.
 * `startBounds` is needed to keep the fixed edge anchored after snapping.
 */
export function snapResizedBoundsLocked(
  bounds: NodeBounds,
  startBounds: NodeBounds,
  handle: ResizeHandle,
  gridSize: number,
  constraints: ResizeConstraints,
  aspectRatio: number
): NodeBounds {
  const right = startBounds.x + startBounds.width
  const bottom = startBounds.y + startBounds.height

  if (handle === 'n' || handle === 's') {
    const snappedH = snapSize(bounds.height, gridSize, constraints.minHeight)
    const snappedW = Math.max(constraints.minWidth, snappedH * aspectRatio)
    const y = handle === 'n' ? bottom - snappedH : bounds.y
    return { x: bounds.x, y, width: snappedW, height: snappedH }
  }

  // Width-primary for e, w, and all corner handles
  const snappedW = snapSize(bounds.width, gridSize, constraints.minWidth)
  const snappedH = Math.max(constraints.minHeight, snappedW / aspectRatio)
  const x = handle.includes('w') ? right - snappedW : bounds.x
  const y = handle.includes('n') ? bottom - snappedH : bounds.y
  return { x, y, width: snappedW, height: snappedH }
}
