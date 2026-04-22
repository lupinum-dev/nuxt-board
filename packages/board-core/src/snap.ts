import type {
  BoardNode,
  NodeId,
  ResizeHandle,
  SnapAxis,
  SnapGuide,
} from './types'

interface EdgeCandidate {
  axis: SnapAxis
  value: number
  extentMin: number
  extentMax: number
}

export interface SnapResult {
  bounds: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>
  guides: SnapGuide[]
}

export interface DragSnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

export function collectNodeEdges(
  node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
): EdgeCandidate[] {
  const right = node.x + node.width
  const bottom = node.y + node.height
  return [
    { axis: 'x', value: node.x, extentMin: node.y, extentMax: bottom },
    { axis: 'x', value: right, extentMin: node.y, extentMax: bottom },
    { axis: 'y', value: node.y, extentMin: node.x, extentMax: right },
    { axis: 'y', value: bottom, extentMin: node.x, extentMax: right },
  ]
}

export function collectOtherNodeEdges(
  nodes: Iterable<BoardNode>,
  excludeId: NodeId,
): EdgeCandidate[] {
  const edges: EdgeCandidate[] = []
  for (const node of nodes) {
    if (node.id === excludeId || !node.visible) continue
    edges.push(...collectNodeEdges(node))
  }
  return edges
}

export function collectOtherNodeEdgesExcluding(
  nodes: Iterable<BoardNode>,
  excludeIds: Set<NodeId>,
): EdgeCandidate[] {
  const edges: EdgeCandidate[] = []
  for (const node of nodes) {
    if (excludeIds.has(node.id) || !node.visible) continue
    edges.push(...collectNodeEdges(node))
  }
  return edges
}

function findBestSnap(
  activeValue: number,
  activeExtentMin: number,
  activeExtentMax: number,
  axis: SnapAxis,
  candidates: EdgeCandidate[],
  threshold: number,
): { snappedValue: number; guide: SnapGuide } | null {
  let bestDist = threshold
  let bestCandidate: EdgeCandidate | null = null

  for (const candidate of candidates) {
    if (candidate.axis !== axis) continue
    const dist = Math.abs(candidate.value - activeValue)
    if (dist < bestDist) {
      bestDist = dist
      bestCandidate = candidate
    }
  }

  if (!bestCandidate) return null

  const guideFrom = Math.min(activeExtentMin, bestCandidate.extentMin)
  const guideTo = Math.max(activeExtentMax, bestCandidate.extentMax)

  return {
    snappedValue: bestCandidate.value,
    guide: {
      axis,
      position: bestCandidate.value,
      from: guideFrom,
      to: guideTo,
    },
  }
}

export function snapBoundsToEdges(
  bounds: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  otherEdges: EdgeCandidate[],
  threshold: number,
): SnapResult {
  let { x, y, width, height } = bounds
  const guides: SnapGuide[] = []

  const right = x + width
  const bottom = y + height

  if (handle.includes('e')) {
    const snap = findBestSnap(right, y, bottom, 'x', otherEdges, threshold)
    if (snap) {
      width = snap.snappedValue - x
      guides.push(snap.guide)
    }
  }

  if (handle.includes('w')) {
    const snap = findBestSnap(x, y, bottom, 'x', otherEdges, threshold)
    if (snap) {
      const oldRight = x + width
      x = snap.snappedValue
      width = oldRight - x
      guides.push(snap.guide)
    }
  }

  if (handle.includes('s')) {
    const snap = findBestSnap(bottom, x, right, 'y', otherEdges, threshold)
    if (snap) {
      height = snap.snappedValue - y
      guides.push(snap.guide)
    }
  }

  if (handle.includes('n')) {
    const snap = findBestSnap(y, x, right, 'y', otherEdges, threshold)
    if (snap) {
      const oldBottom = y + height
      y = snap.snappedValue
      height = oldBottom - y
      guides.push(snap.guide)
    }
  }

  return { bounds: { x, y, width, height }, guides }
}

export function snapPositionToEdges(
  bounds: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  otherEdges: EdgeCandidate[],
  threshold: number,
): DragSnapResult {
  let dx = 0
  let dy = 0
  const guides: SnapGuide[] = []

  const { x, y, width, height } = bounds
  const right = x + width
  const bottom = y + height

  // Snap X axis: check left and right edges, pick closest
  const snapLeft = findBestSnap(x, y, bottom, 'x', otherEdges, threshold)
  const snapRight = findBestSnap(right, y, bottom, 'x', otherEdges, threshold)

  if (snapLeft && snapRight) {
    const distLeft = Math.abs(snapLeft.snappedValue - x)
    const distRight = Math.abs(snapRight.snappedValue - right)
    if (distLeft <= distRight) {
      dx = snapLeft.snappedValue - x
      guides.push(snapLeft.guide)
    } else {
      dx = snapRight.snappedValue - right
      guides.push(snapRight.guide)
    }
  } else if (snapLeft) {
    dx = snapLeft.snappedValue - x
    guides.push(snapLeft.guide)
  } else if (snapRight) {
    dx = snapRight.snappedValue - right
    guides.push(snapRight.guide)
  }

  // Snap Y axis: check top and bottom edges, pick closest
  const snapTop = findBestSnap(
    y,
    x + dx,
    right + dx,
    'y',
    otherEdges,
    threshold,
  )
  const snapBottom = findBestSnap(
    bottom,
    x + dx,
    right + dx,
    'y',
    otherEdges,
    threshold,
  )

  if (snapTop && snapBottom) {
    const distTop = Math.abs(snapTop.snappedValue - y)
    const distBottom = Math.abs(snapBottom.snappedValue - bottom)
    if (distTop <= distBottom) {
      dy = snapTop.snappedValue - y
      guides.push(snapTop.guide)
    } else {
      dy = snapBottom.snappedValue - bottom
      guides.push(snapBottom.guide)
    }
  } else if (snapTop) {
    dy = snapTop.snappedValue - y
    guides.push(snapTop.guide)
  } else if (snapBottom) {
    dy = snapBottom.snappedValue - bottom
    guides.push(snapBottom.guide)
  }

  return { dx, dy, guides }
}
