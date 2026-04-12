import { snapSize, snapValue } from './math'
import type { CanvasNode, ResizeHandle } from './types'

export interface ResizeConstraints {
  minWidth: number
  minHeight: number
}

export function applyResizeDelta(
  node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  constraints: ResizeConstraints
): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'> {
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
  bounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  gridSize: number,
  constraints: ResizeConstraints
): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'> {
  let { x, y, width, height } = bounds
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height

  if (handle.includes('e')) {
    width = snapSize(width, gridSize, constraints.minWidth)
  }

  if (handle.includes('s')) {
    height = snapSize(height, gridSize, constraints.minHeight)
  }

  if (handle.includes('w')) {
    width = snapSize(width, gridSize, constraints.minWidth)
    x = right - width
    x = snapValue(x, gridSize)
    width = Math.max(constraints.minWidth, right - x)
  } else {
    x = snapValue(x, gridSize)
  }

  if (handle.includes('n')) {
    height = snapSize(height, gridSize, constraints.minHeight)
    y = bottom - height
    y = snapValue(y, gridSize)
    height = Math.max(constraints.minHeight, bottom - y)
  } else {
    y = snapValue(y, gridSize)
  }

  return { x, y, width, height }
}
