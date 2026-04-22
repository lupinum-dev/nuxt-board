import {
  boundsIntersect,
  type BoardEngine,
  type BoardNode,
  type Bounds,
  type Point,
} from '@lupinum/board-core'
import type {
  AnchorPosition,
  AnchorSide,
  BoardEdge,
  ConnectionRoute,
  ConnectionRouteSegment,
  ConnectionRouting,
  ResolvedConnectionEndpoint,
} from './types'
import { buildArcRoute } from './routing/arc'

const AUTO_SIDE_DEADBAND = 24
const AUTO_ANCHOR_OFFSET = 0.5
const STEP_OFFSET = 24
const SMOOTH_STEP_RADIUS = 10

type Axis = 'horizontal' | 'vertical'
type Position = AnchorSide

const DIRECTION_VECTORS: Record<AnchorSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sideAxis(side: AnchorSide): Axis {
  return side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
}

function sideToPosition(side: AnchorSide): Position {
  return side
}

function point(x: number, y: number): Point {
  return { x, y }
}

function nodeCenter(
  node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  }
}

export function resolveAnchorPoint(
  node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  anchor: AnchorPosition,
): Point {
  const offset = clamp(anchor.offset, 0, 1)
  switch (anchor.side) {
    case 'top':
      return { x: node.x + node.width * offset, y: node.y }
    case 'bottom':
      return { x: node.x + node.width * offset, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height * offset }
    case 'right':
    default:
      return { x: node.x + node.width, y: node.y + node.height * offset }
  }
}

export function resolveAutoAnchorSide(
  source: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  target: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  _role: 'source' | 'target',
  previousSide?: AnchorSide,
): AnchorSide {
  const from = nodeCenter(source)
  const to = nodeCenter(target)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx < 0.001 && absDy < 0.001) {
    if (previousSide) {
      return previousSide
    }
    return 'right'
  }

  let axis: Axis = absDx >= absDy ? 'horizontal' : 'vertical'
  if (previousSide) {
    const prevAxis = sideAxis(previousSide)
    const delta = Math.abs(absDx - absDy)
    if (prevAxis !== axis && delta < AUTO_SIDE_DEADBAND) {
      axis = prevAxis
    }
  }

  if (axis === 'horizontal') {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'bottom' : 'top'
}

export function resolveConnectionEndpoint(
  edge: BoardEdge,
  node: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>,
  otherNode: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>,
  role: 'source' | 'target',
  previousSide?: AnchorSide,
): ResolvedConnectionEndpoint {
  const explicitAnchor = role === 'source' ? edge.fromAnchor : edge.toAnchor
  if (explicitAnchor) {
    return {
      nodeId: node.id,
      node,
      side: explicitAnchor.side,
      offset: clamp(explicitAnchor.offset, 0, 1),
      point: resolveAnchorPoint(node, explicitAnchor),
      kind: 'explicit',
    }
  }
  const side = resolveAutoAnchorSide(node, otherNode, role, previousSide)
  const offset = AUTO_ANCHOR_OFFSET
  return {
    nodeId: node.id,
    node,
    side,
    offset,
    point: resolveAnchorPoint(node, { side, offset }),
    kind: 'auto',
  }
}

export function resolveFloatingEndpoint(
  pointValue: Point,
  otherPoint: Point,
  role: 'source' | 'target',
  previousSide?: AnchorSide,
): ResolvedConnectionEndpoint {
  const probeNode = {
    id: `floating-${role}` as BoardNode['id'],
    x: pointValue.x,
    y: pointValue.y,
    width: 0,
    height: 0,
  }
  const otherNode = {
    id: `other-${role}` as BoardNode['id'],
    x: otherPoint.x,
    y: otherPoint.y,
    width: 0,
    height: 0,
  }
  const side = resolveAutoAnchorSide(probeNode, otherNode, role, previousSide)

  return {
    nodeId: probeNode.id,
    node: probeNode,
    side,
    offset: 0.5,
    point: pointValue,
    kind: 'auto',
  }
}

function boundsFromPoints(points: Point[]): Bounds {
  return points.reduce<Bounds>(
    (acc, current) => ({
      minX: Math.min(acc.minX, current.x),
      minY: Math.min(acc.minY, current.y),
      maxX: Math.max(acc.maxX, current.x),
      maxY: Math.max(acc.maxY, current.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

function cubicAt(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const mt = 1 - t
  return (
    mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3
  )
}

function cubicDerivativeRoots(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = p1 - p0
  const roots: number[] = []

  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) < 1e-9) {
      return roots
    }
    const t = -c / b
    if (t > 0 && t < 1) {
      roots.push(t)
    }
    return roots
  }

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    return roots
  }

  const sqrt = Math.sqrt(discriminant)
  const candidates = [(-b + sqrt) / (2 * a), (-b - sqrt) / (2 * a)]
  for (const t of candidates) {
    if (t > 0 && t < 1) {
      roots.push(t)
    }
  }
  return roots
}

function cubicBounds(
  from: Point,
  control1: Point,
  control2: Point,
  to: Point,
): Bounds {
  const ts = new Set<number>([0, 1])
  for (const root of cubicDerivativeRoots(
    from.x,
    control1.x,
    control2.x,
    to.x,
  )) {
    ts.add(root)
  }
  for (const root of cubicDerivativeRoots(
    from.y,
    control1.y,
    control2.y,
    to.y,
  )) {
    ts.add(root)
  }

  const samples = [...ts].map((t) =>
    point(
      cubicAt(from.x, control1.x, control2.x, to.x, t),
      cubicAt(from.y, control1.y, control2.y, to.y, t),
    ),
  )
  return boundsFromPoints(samples)
}

function getBezierEdgeCenter(params: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourceControlX: number
  sourceControlY: number
  targetControlX: number
  targetControlY: number
}): Point {
  return {
    x:
      params.sourceX * 0.125 +
      params.sourceControlX * 0.375 +
      params.targetControlX * 0.375 +
      params.targetX * 0.125,
    y:
      params.sourceY * 0.125 +
      params.sourceControlY * 0.375 +
      params.targetControlY * 0.375 +
      params.targetY * 0.125,
  }
}

const SHORT_BOW_KNEE = 400
const SHORT_BOW_BOOST = 0.35

function calculateControlOffset(distance: number, curvature: number): number {
  const t = clamp(1 - Math.abs(distance) / SHORT_BOW_KNEE, 0, 1)
  const bowBoost = t * t * SHORT_BOW_BOOST
  if (distance >= 0) {
    return (0.5 + bowBoost) * distance
  }
  return (curvature + bowBoost) * 25 * Math.sqrt(-distance)
}

function getControlWithCurvature(params: {
  pos: Position
  x1: number
  y1: number
  x2: number
  y2: number
  curvature: number
}): Point {
  switch (params.pos) {
    case 'left':
      return point(
        params.x1 -
          calculateControlOffset(params.x1 - params.x2, params.curvature),
        params.y1,
      )
    case 'right':
      return point(
        params.x1 +
          calculateControlOffset(params.x2 - params.x1, params.curvature),
        params.y1,
      )
    case 'top':
      return point(
        params.x1,
        params.y1 -
          calculateControlOffset(params.y1 - params.y2, params.curvature),
      )
    case 'bottom':
    default:
      return point(
        params.x1,
        params.y1 +
          calculateControlOffset(params.y2 - params.y1, params.curvature),
      )
  }
}

function buildBezierRoute(
  source: ResolvedConnectionEndpoint,
  target: ResolvedConnectionEndpoint,
): ConnectionRoute {
  const control1 = getControlWithCurvature({
    pos: sideToPosition(source.side),
    x1: source.point.x,
    y1: source.point.y,
    x2: target.point.x,
    y2: target.point.y,
    curvature: 0.25,
  })
  const control2 = getControlWithCurvature({
    pos: sideToPosition(target.side),
    x1: target.point.x,
    y1: target.point.y,
    x2: source.point.x,
    y2: source.point.y,
    curvature: 0.25,
  })

  return {
    routing: 'bezier',
    path: `M${source.point.x},${source.point.y} C${control1.x},${control1.y} ${control2.x},${control2.y} ${target.point.x},${target.point.y}`,
    labelPoint: getBezierEdgeCenter({
      sourceX: source.point.x,
      sourceY: source.point.y,
      targetX: target.point.x,
      targetY: target.point.y,
      sourceControlX: control1.x,
      sourceControlY: control1.y,
      targetControlX: control2.x,
      targetControlY: control2.y,
    }),
    bounds: cubicBounds(source.point, control1, control2, target.point),
    waypoints: [source.point, target.point],
    segments: [
      {
        type: 'cubic',
        from: source.point,
        control1,
        control2,
        to: target.point,
      },
    ],
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function getStepDirection(params: {
  source: Point
  sourcePosition: Position
  target: Point
}): Point {
  if (params.sourcePosition === 'left' || params.sourcePosition === 'right') {
    return params.source.x < params.target.x ? point(1, 0) : point(-1, 0)
  }
  return params.source.y < params.target.y ? point(0, 1) : point(0, -1)
}

function getEdgeCenter(source: Point, target: Point): Point {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  }
}

function getSmoothStepPoints(params: {
  source: Point
  sourcePosition: Position
  target: Point
  targetPosition: Position
  offset: number
  stepPosition: number
}): [Point[], Point] {
  const sourceDir = DIRECTION_VECTORS[params.sourcePosition]
  const targetDir = DIRECTION_VECTORS[params.targetPosition]
  const sourceGapped = point(
    params.source.x + sourceDir.x * params.offset,
    params.source.y + sourceDir.y * params.offset,
  )
  const targetGapped = point(
    params.target.x + targetDir.x * params.offset,
    params.target.y + targetDir.y * params.offset,
  )
  const dir = getStepDirection({
    source: sourceGapped,
    sourcePosition: params.sourcePosition,
    target: targetGapped,
  })
  const dirAccessor = dir.x !== 0 ? 'x' : 'y'
  const currDir = dir[dirAccessor]
  let points: Point[] = []
  let center = getEdgeCenter(params.source, params.target)
  const sourceGapOffset = point(0, 0)
  const targetGapOffset = point(0, 0)

  if (
    (sourceDir as Record<'x' | 'y', number>)[dirAccessor] *
      (targetDir as Record<'x' | 'y', number>)[dirAccessor] ===
    -1
  ) {
    const centerX =
      dirAccessor === 'x'
        ? sourceGapped.x +
          (targetGapped.x - sourceGapped.x) * params.stepPosition
        : (sourceGapped.x + targetGapped.x) / 2
    const centerY =
      dirAccessor === 'y'
        ? sourceGapped.y +
          (targetGapped.y - sourceGapped.y) * params.stepPosition
        : (sourceGapped.y + targetGapped.y) / 2

    const verticalSplit = [
      point(centerX, sourceGapped.y),
      point(centerX, targetGapped.y),
    ]
    const horizontalSplit = [
      point(sourceGapped.x, centerY),
      point(targetGapped.x, centerY),
    ]
    if ((sourceDir as Record<'x' | 'y', number>)[dirAccessor] === currDir) {
      points = dirAccessor === 'x' ? verticalSplit : horizontalSplit
    } else {
      points = dirAccessor === 'x' ? horizontalSplit : verticalSplit
    }
  } else {
    const sourceTarget = [point(sourceGapped.x, targetGapped.y)]
    const targetSource = [point(targetGapped.x, sourceGapped.y)]
    if (dirAccessor === 'x') {
      points = sourceDir.x === currDir ? targetSource : sourceTarget
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource
    }

    if (params.sourcePosition === params.targetPosition) {
      const diff = Math.abs(
        (params.source as Record<'x' | 'y', number>)[dirAccessor] -
          (params.target as Record<'x' | 'y', number>)[dirAccessor],
      )
      if (diff <= params.offset) {
        const gapOffset = Math.min(params.offset - 1, params.offset - diff)
        if ((sourceDir as Record<'x' | 'y', number>)[dirAccessor] === currDir) {
          ;(sourceGapOffset as Record<'x' | 'y', number>)[dirAccessor] =
            ((sourceGapped as Record<'x' | 'y', number>)[dirAccessor] >
            (params.source as Record<'x' | 'y', number>)[dirAccessor]
              ? -1
              : 1) * gapOffset
        } else {
          ;(targetGapOffset as Record<'x' | 'y', number>)[dirAccessor] =
            ((targetGapped as Record<'x' | 'y', number>)[dirAccessor] >
            (params.target as Record<'x' | 'y', number>)[dirAccessor]
              ? -1
              : 1) * gapOffset
        }
      }
    }

    if (params.sourcePosition !== params.targetPosition) {
      const dirAccessorOpposite = dirAccessor === 'x' ? 'y' : 'x'
      const isSameDir =
        (sourceDir as Record<'x' | 'y', number>)[dirAccessor] ===
        (targetDir as Record<'x' | 'y', number>)[dirAccessorOpposite]
      const sourceGtTargetOpposite =
        (sourceGapped as Record<'x' | 'y', number>)[dirAccessorOpposite] >
        (targetGapped as Record<'x' | 'y', number>)[dirAccessorOpposite]
      const sourceLtTargetOpposite =
        (sourceGapped as Record<'x' | 'y', number>)[dirAccessorOpposite] <
        (targetGapped as Record<'x' | 'y', number>)[dirAccessorOpposite]

      const flipSourceTarget =
        ((sourceDir as Record<'x' | 'y', number>)[dirAccessor] === 1 &&
          ((!isSameDir && sourceGtTargetOpposite) ||
            (isSameDir && sourceLtTargetOpposite))) ||
        ((sourceDir as Record<'x' | 'y', number>)[dirAccessor] !== 1 &&
          ((!isSameDir && sourceLtTargetOpposite) ||
            (isSameDir && sourceGtTargetOpposite)))

      if (flipSourceTarget) {
        points = dirAccessor === 'x' ? sourceTarget : targetSource
      }
    }

    const sourceGapPoint = point(
      sourceGapped.x + sourceGapOffset.x,
      sourceGapped.y + sourceGapOffset.y,
    )
    const targetGapPoint = point(
      targetGapped.x + targetGapOffset.x,
      targetGapped.y + targetGapOffset.y,
    )
    const maxXDistance = Math.max(
      Math.abs(sourceGapPoint.x - points[0]!.x),
      Math.abs(targetGapPoint.x - points[0]!.x),
    )
    const maxYDistance = Math.max(
      Math.abs(sourceGapPoint.y - points[0]!.y),
      Math.abs(targetGapPoint.y - points[0]!.y),
    )
    center =
      maxXDistance >= maxYDistance
        ? point((sourceGapPoint.x + targetGapPoint.x) / 2, points[0]!.y)
        : point(points[0]!.x, (sourceGapPoint.y + targetGapPoint.y) / 2)
  }

  const gappedSource = point(
    sourceGapped.x + sourceGapOffset.x,
    sourceGapped.y + sourceGapOffset.y,
  )
  const gappedTarget = point(
    targetGapped.x + targetGapOffset.x,
    targetGapped.y + targetGapOffset.y,
  )

  const pathPoints = [
    params.source,
    ...(gappedSource.x !== points[0]!.x || gappedSource.y !== points[0]!.y
      ? [gappedSource]
      : []),
    ...points,
    ...(gappedTarget.x !== points[points.length - 1]!.x ||
    gappedTarget.y !== points[points.length - 1]!.y
      ? [gappedTarget]
      : []),
    params.target,
  ]

  return [pathPoints, center]
}

function getBend(a: Point, b: Point, c: Point, radius: number): string {
  if (radius <= 0) {
    return `L${b.x} ${b.y}`
  }

  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, radius)
  const { x, y } = b
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`
  }
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1
    const yDir = a.y < c.y ? 1 : -1
    return `L${x + bendSize * xDir},${y}Q${x},${y} ${x},${y + bendSize * yDir}`
  }
  const xDir = a.x < c.x ? 1 : -1
  const yDir = a.y < c.y ? -1 : 1
  return `L${x},${y + bendSize * yDir}Q${x},${y} ${x + bendSize * xDir},${y}`
}

function buildStepLikeRoute(
  source: ResolvedConnectionEndpoint,
  target: ResolvedConnectionEndpoint,
  routing: 'smooth-step' | 'step',
): ConnectionRoute {
  const [points, labelPoint] = getSmoothStepPoints({
    source: source.point,
    sourcePosition: sideToPosition(source.side),
    target: target.point,
    targetPosition: sideToPosition(target.side),
    offset: STEP_OFFSET,
    stepPosition: 0.5,
  })

  let path = `M${points[0]!.x} ${points[0]!.y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    path += getBend(
      points[index - 1]!,
      points[index]!,
      points[index + 1]!,
      routing === 'smooth-step' ? SMOOTH_STEP_RADIUS : 0,
    )
  }
  path += `L${points[points.length - 1]!.x} ${points[points.length - 1]!.y}`

  return {
    routing,
    path,
    labelPoint,
    bounds: boundsFromPoints(points),
    waypoints: points,
    segments: points.slice(0, -1).map((current, index) => ({
      type: 'line' as const,
      from: current,
      to: points[index + 1]!,
    })),
  }
}

function buildStraightRoute(
  source: ResolvedConnectionEndpoint,
  target: ResolvedConnectionEndpoint,
): ConnectionRoute {
  return {
    routing: 'straight',
    path: `M${source.point.x} ${source.point.y} L${target.point.x} ${target.point.y}`,
    labelPoint: getEdgeCenter(source.point, target.point),
    bounds: boundsFromPoints([source.point, target.point]),
    waypoints: [source.point, target.point],
    segments: [{ type: 'line', from: source.point, to: target.point }],
  }
}

export function buildConnectionRoute(params: {
  source: ResolvedConnectionEndpoint
  target: ResolvedConnectionEndpoint
  routing?: ConnectionRouting
}): ConnectionRoute {
  switch (params.routing ?? 'bezier') {
    case 'straight':
      return buildStraightRoute(params.source, params.target)
    case 'step':
      return buildStepLikeRoute(params.source, params.target, 'step')
    case 'smooth-step':
      return buildStepLikeRoute(params.source, params.target, 'smooth-step')
    case 'arc':
      return buildArcRoute(params.source, params.target)
    case 'bezier':
    default:
      return buildBezierRoute(params.source, params.target)
  }
}

export function resolveEdgeRenderState(
  edge: BoardEdge,
  sourceNode: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>,
  targetNode: Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'>,
  options: {
    routing?: ConnectionRouting
    previousSourceSide?: AnchorSide
    previousTargetSide?: AnchorSide
  } = {},
): {
  source: ResolvedConnectionEndpoint
  target: ResolvedConnectionEndpoint
  route: ConnectionRoute
} {
  const source = resolveConnectionEndpoint(
    edge,
    sourceNode,
    targetNode,
    'source',
    options.previousSourceSide,
  )
  const target = resolveConnectionEndpoint(
    edge,
    targetNode,
    sourceNode,
    'target',
    options.previousTargetSide,
  )
  return {
    source,
    target,
    route: buildConnectionRoute({
      source,
      target,
      routing: options.routing,
    }),
  }
}

export function getVisibleEdges(
  engine: BoardEngine,
  bounds: Bounds,
  routing?: ConnectionRouting,
): BoardEdge[] {
  const nodes = engine.$nodes.get()
  return engine.ext.connections.getEdges().filter((edge) => {
    const sourceNode = nodes.get(edge.from)
    const targetNode = nodes.get(edge.to)
    if (!sourceNode || !targetNode) {
      return false
    }
    const { route } = resolveEdgeRenderState(edge, sourceNode, targetNode, {
      routing,
    })
    return boundsIntersect(bounds, route.bounds)
  })
}
