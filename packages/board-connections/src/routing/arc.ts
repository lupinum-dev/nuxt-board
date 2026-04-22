/**
 * Arc routing for board-connections.
 *
 * Port of `perfect-arrows` by Steve Ruiz (MIT License).
 * Original: https://github.com/steveruizok/perfect-arrows
 *
 * Copyright (c) 2020 Stephen Ruiz Ltd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Adapted for @lupinum/board-connections: typed with our Point/Bounds types,
 * returns a ConnectionRoute, uses our AnchorSide resolution for the
 * ResolvedConnectionEndpoint contract.
 */
import type { Bounds, Point } from '@lupinum/board-core'
import type { ConnectionRoute, ResolvedConnectionEndpoint } from '../types'

type Box = { x: number; y: number; w: number; h: number }

const PI = Math.PI

function modulate(
  value: number,
  rangeA: [number, number],
  rangeB: [number, number],
  clamp = false,
): number {
  const [fromLow, fromHigh] = rangeA
  const [toLow, toHigh] = rangeB
  const result =
    toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow)
  if (!clamp) {
    return result
  }
  return toLow < toHigh
    ? Math.max(Math.min(result, toHigh), toLow)
    : Math.max(Math.min(result, toLow), toHigh)
}

function getAngle(x0: number, y0: number, x1: number, y1: number): number {
  return Math.atan2(y1 - y0, x1 - x0)
}

function getDistance(x0: number, y0: number, x1: number, y1: number): number {
  return Math.hypot(x1 - x0, y1 - y0)
}

function getIntermediate(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function getPointBetween(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
): [number, number] {
  return [getIntermediate(x0, x1, t), getIntermediate(y0, y1, t)]
}

function doBoxesCollide(a: Box, b: Box): boolean {
  return !(
    a.x > b.x + b.w ||
    a.x + a.w < b.x ||
    a.y > b.y + b.h ||
    a.y + a.h < b.y
  )
}

function expandBox(box: Box, amount: number): Box {
  return {
    x: box.x - amount,
    y: box.y - amount,
    w: box.w + amount * 2,
    h: box.h + amount * 2,
  }
}

function getBoxToBoxArrow(
  x0: number,
  y0: number,
  w0: number,
  h0: number,
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  options: {
    bow?: number
    stretch?: number
    stretchMin?: number
    stretchMax?: number
    padStart?: number
    padEnd?: number
    flip?: boolean
    straights?: boolean
  } = {},
): [number, number, number, number, number, number, number, number] {
  const bow = options.bow ?? 0
  const stretch = options.stretch ?? 0.25
  const stretchMin = options.stretchMin ?? 50
  const stretchMax = options.stretchMax ?? 420
  const padStart = options.padStart ?? 0
  const padEnd = options.padEnd ?? 20
  const flip = options.flip ?? false
  const straights = options.straights ?? true

  const startBox: Box = { x: x0, y: y0, w: w0, h: h0 }
  const endBox: Box = { x: x1, y: y1, w: w1, h: h1 }
  const paddedStart = expandBox(startBox, padStart)
  const paddedEnd = expandBox(endBox, padEnd)

  const cx0 = x0 + w0 / 2
  const cy0 = y0 + h0 / 2
  const cx1 = x1 + w1 / 2
  const cy1 = y1 + h1 / 2

  const angle = getAngle(cx0, cy0, cx1, cy1)
  const distance = getDistance(cx0, cy0, cx1, cy1)

  let [sx, sy] = [cx0, cy0]
  let [ex, ey] = [cx1, cy1]

  const overlap = doBoxesCollide(paddedStart, paddedEnd)
  if (overlap) {
    const [mx, my] = getPointBetween(cx0, cy0, cx1, cy1, 0.5)
    const boxAngle = getAngle(cx0, cy0, cx1, cy1)
    sx = cx0 + Math.cos(boxAngle) * (w0 / 2 + padStart)
    sy = cy0 + Math.sin(boxAngle) * (h0 / 2 + padStart)
    ex = cx1 - Math.cos(boxAngle) * (w1 / 2 + padEnd)
    ey = cy1 - Math.sin(boxAngle) * (h1 / 2 + padEnd)
    const [cx, cy] = [
      getIntermediate(sx, ex, 0.5),
      getIntermediate(sy, ey, 0.5),
    ]
    return [sx, sy, cx, cy, ex, ey, boxAngle + PI, boxAngle + PI]
  }

  const halfW0 = w0 / 2
  const halfH0 = h0 / 2
  const halfW1 = w1 / 2
  const halfH1 = h1 / 2

  const slope = Math.tan(angle)
  const absSlope = Math.abs(slope)
  const boxSlope0 = halfH0 / halfW0
  const boxSlope1 = halfH1 / halfW1

  if (absSlope > boxSlope0) {
    sy = cy0 + (cy1 > cy0 ? halfH0 + padStart : -(halfH0 + padStart))
    sx = cx0 + (cy1 > cy0 ? halfH0 + padStart : -(halfH0 + padStart)) / slope
  } else {
    sx = cx0 + (cx1 > cx0 ? halfW0 + padStart : -(halfW0 + padStart))
    sy = cy0 + (cx1 > cx0 ? halfW0 + padStart : -(halfW0 + padStart)) * slope
  }

  if (absSlope > boxSlope1) {
    ey = cy1 + (cy0 > cy1 ? halfH1 + padEnd : -(halfH1 + padEnd))
    ex = cx1 + (cy0 > cy1 ? halfH1 + padEnd : -(halfH1 + padEnd)) / slope
  } else {
    ex = cx1 + (cx0 > cx1 ? halfW1 + padEnd : -(halfW1 + padEnd))
    ey = cy1 + (cx0 > cx1 ? halfW1 + padEnd : -(halfW1 + padEnd)) * slope
  }

  const arrowDistance = getDistance(sx, sy, ex, ey)
  const bowAmount =
    modulate(arrowDistance, [stretchMin, stretchMax], [1, 0], true) * stretch +
    bow
  const arrowAngle = getAngle(sx, sy, ex, ey)
  const midX = getIntermediate(sx, ex, 0.5)
  const midY = getIntermediate(sy, ey, 0.5)
  const offset = arrowDistance * bowAmount
  const perp = arrowAngle + PI / 2
  const sign = flip ? -1 : 1
  const cx = midX + Math.cos(perp) * offset * sign
  const cy = midY + Math.sin(perp) * offset * sign

  if (straights && Math.abs(cx - midX) < 1 && Math.abs(cy - midY) < 1) {
    return [sx, sy, midX, midY, ex, ey, arrowAngle + PI, arrowAngle]
  }

  const startAngle = getAngle(sx, sy, cx, cy) + PI
  const endAngle = getAngle(ex, ey, cx, cy)

  return [sx, sy, cx, cy, ex, ey, startAngle, endAngle]
}

function quadraticAt(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

function quadraticBounds(from: Point, control: Point, to: Point): Bounds {
  const ts: Set<number> = new Set([0, 1])
  for (const axis of ['x', 'y'] as const) {
    const p0 = from[axis]
    const p1 = control[axis]
    const p2 = to[axis]
    const denom = p0 - 2 * p1 + p2
    if (Math.abs(denom) > 1e-9) {
      const t = (p0 - p1) / denom
      if (t > 0 && t < 1) {
        ts.add(t)
      }
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const t of ts) {
    const x = quadraticAt(from.x, control.x, to.x, t)
    const y = quadraticAt(from.y, control.y, to.y, t)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

function quadraticMidpoint(from: Point, control: Point, to: Point): Point {
  return {
    x: quadraticAt(from.x, control.x, to.x, 0.5),
    y: quadraticAt(from.y, control.y, to.y, 0.5),
  }
}

export interface ArcOptions {
  bow?: number
  stretch?: number
  stretchMin?: number
  stretchMax?: number
  padStart?: number
  padEnd?: number
  flip?: boolean
}

export function buildArcRoute(
  source: ResolvedConnectionEndpoint,
  target: ResolvedConnectionEndpoint,
  options: ArcOptions = {},
): ConnectionRoute {
  const [sx, sy, cx, cy, ex, ey] = getBoxToBoxArrow(
    source.node.x,
    source.node.y,
    source.node.width,
    source.node.height,
    target.node.x,
    target.node.y,
    target.node.width,
    target.node.height,
    {
      bow: options.bow ?? 0,
      stretch: options.stretch ?? 0.25,
      stretchMin: options.stretchMin ?? 50,
      stretchMax: options.stretchMax ?? 420,
      padStart: options.padStart ?? 0,
      padEnd: options.padEnd ?? 0,
      flip: options.flip ?? false,
      straights: true,
    },
  )

  const from: Point = { x: sx, y: sy }
  const control: Point = { x: cx, y: cy }
  const to: Point = { x: ex, y: ey }

  return {
    routing: 'arc',
    path: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`,
    labelPoint: quadraticMidpoint(from, control, to),
    bounds: quadraticBounds(from, control, to),
    waypoints: [from, to],
    segments: [
      {
        type: 'cubic',
        from,
        control1: control,
        control2: control,
        to,
      },
    ],
  }
}
