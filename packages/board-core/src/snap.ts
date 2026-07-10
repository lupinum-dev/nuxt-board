import type {
  BoardNode,
  NodeId,
  ResizeHandle,
  SnapAxis,
  SnapGuide,
} from './types.js'

interface EdgeCandidate {
  axis: SnapAxis
  value: number
  extentMin: number
  extentMax: number
  nodeId?: NodeId
}

export interface SnapEdgeIndex {
  readonly x: readonly EdgeCandidate[]
  readonly y: readonly EdgeCandidate[]
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

/** Rebuildable index derived only from the current canonical node root. */
export function buildSnapEdgeIndex(nodes: Iterable<BoardNode>): SnapEdgeIndex {
  const x: EdgeCandidate[] = []
  const y: EdgeCandidate[] = []
  for (const node of nodes) {
    if (!node.visible) continue
    for (const edge of collectNodeEdges(node)) {
      ;(edge.axis === 'x' ? x : y).push({ ...edge, nodeId: node.id })
    }
  }
  x.sort((left, right) => left.value - right.value)
  y.sort((left, right) => left.value - right.value)
  return { x, y }
}

function lowerBound(
  candidates: readonly EdgeCandidate[],
  value: number,
): number {
  let low = 0
  let high = candidates.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (candidates[middle]!.value < value) low = middle + 1
    else high = middle
  }
  return low
}

function findBestSnap(
  activeValue: number,
  activeExtentMin: number,
  activeExtentMax: number,
  axis: SnapAxis,
  candidates: EdgeCandidate[],
  threshold: number,
  index?: SnapEdgeIndex,
  excludeIds?: ReadonlySet<NodeId>,
): { snappedValue: number; guide: SnapGuide } | null {
  let bestDist = threshold
  let bestCandidate: EdgeCandidate | null = null

  const source = index?.[axis] ?? candidates
  const start = index ? lowerBound(source, activeValue - threshold) : 0
  for (let position = start; position < source.length; position += 1) {
    const candidate = source[position]!
    if (index && candidate.value >= activeValue + threshold) break
    if (candidate.axis !== axis) continue
    if (candidate.nodeId && excludeIds?.has(candidate.nodeId)) continue
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
  otherEdges: EdgeCandidate[] | SnapEdgeIndex,
  threshold: number,
  excludeIds?: ReadonlySet<NodeId>,
): SnapResult {
  let { x, y, width, height } = bounds
  const guides: SnapGuide[] = []

  const right = x + width
  const bottom = y + height

  if (handle.includes('e')) {
    const snap = findBestSnap(
      right,
      y,
      bottom,
      'x',
      Array.isArray(otherEdges) ? otherEdges : [],
      threshold,
      Array.isArray(otherEdges) ? undefined : otherEdges,
      excludeIds,
    )
    if (snap) {
      width = snap.snappedValue - x
      guides.push(snap.guide)
    }
  }

  if (handle.includes('w')) {
    const snap = findBestSnap(
      x,
      y,
      bottom,
      'x',
      Array.isArray(otherEdges) ? otherEdges : [],
      threshold,
      Array.isArray(otherEdges) ? undefined : otherEdges,
      excludeIds,
    )
    if (snap) {
      const oldRight = x + width
      x = snap.snappedValue
      width = oldRight - x
      guides.push(snap.guide)
    }
  }

  if (handle.includes('s')) {
    const snap = findBestSnap(
      bottom,
      x,
      right,
      'y',
      Array.isArray(otherEdges) ? otherEdges : [],
      threshold,
      Array.isArray(otherEdges) ? undefined : otherEdges,
      excludeIds,
    )
    if (snap) {
      height = snap.snappedValue - y
      guides.push(snap.guide)
    }
  }

  if (handle.includes('n')) {
    const snap = findBestSnap(
      y,
      x,
      right,
      'y',
      Array.isArray(otherEdges) ? otherEdges : [],
      threshold,
      Array.isArray(otherEdges) ? undefined : otherEdges,
      excludeIds,
    )
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
  otherEdges: EdgeCandidate[] | SnapEdgeIndex,
  threshold: number,
  excludeIds?: ReadonlySet<NodeId>,
): DragSnapResult {
  let dx = 0
  let dy = 0
  const guides: SnapGuide[] = []

  const { x, y, width, height } = bounds
  const right = x + width
  const bottom = y + height

  // Snap X axis: check left and right edges, pick closest
  const candidates = Array.isArray(otherEdges) ? otherEdges : []
  const index = Array.isArray(otherEdges) ? undefined : otherEdges
  const snapLeft = findBestSnap(
    x,
    y,
    bottom,
    'x',
    candidates,
    threshold,
    index,
    excludeIds,
  )
  const snapRight = findBestSnap(
    right,
    y,
    bottom,
    'x',
    candidates,
    threshold,
    index,
    excludeIds,
  )

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
    candidates,
    threshold,
    index,
    excludeIds,
  )
  const snapBottom = findBestSnap(
    bottom,
    x + dx,
    right + dx,
    'y',
    candidates,
    threshold,
    index,
    excludeIds,
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
