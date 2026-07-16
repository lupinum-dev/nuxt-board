import { h, type VNode } from 'vue'
import type { BoardNode } from '@lupinum/board-core'
import type { ConnectionDragState } from './controller.js'
import type { BoardEdge, ResolvedConnectionEndpoint } from './types.js'
import type { buildConnectionRoute } from './geometry.js'

export interface ConnectionRenderEntry {
  edge: BoardEdge
  route: ReturnType<typeof buildConnectionRoute>
}

export function renderDefaultEdgePath(options: {
  entry: ConnectionRenderEntry
  markerId: string
  stroke: string
  opacity: number
  strokeWidth: number
}): VNode {
  const { entry } = options
  return h('path', {
    d: entry.route.path,
    stroke: options.stroke,
    color: entry.edge.color ?? 'var(--board-edge-color)',
    fill: 'none',
    opacity: options.opacity,
    'stroke-width': options.strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke',
    'marker-start':
      entry.edge.fromEnd === 'arrow' ? `url(#${options.markerId})` : undefined,
    'marker-end':
      entry.edge.toEnd === 'arrow' ? `url(#${options.markerId})` : undefined,
    style: { pointerEvents: 'none' },
  })
}

interface PreviewRenderState {
  edge: BoardEdge | null
  source: ResolvedConnectionEndpoint
  target: ResolvedConnectionEndpoint
  route: ReturnType<typeof buildConnectionRoute>
  candidateNode: BoardNode | null | undefined
}

export function renderConnectionPreview(options: {
  preview: PreviewRenderState
  drag: ConnectionDragState
  markerId: string
  zoom: number
  handleRadius: number
  strokeWidth: number
}): Array<VNode | null> {
  const { preview, drag } = options
  const stroke = preview.edge?.color ?? 'var(--board-edge-active-color)'
  const fixedEnd =
    drag.mode === 'reconnect' && drag.end === 'from'
      ? preview.target
      : preview.source
  const dynamicEnd =
    drag.mode === 'reconnect' && drag.end === 'from'
      ? preview.source
      : preview.target

  return [
    preview.candidateNode
      ? h('rect', {
          x: preview.candidateNode.x,
          y: preview.candidateNode.y,
          width: preview.candidateNode.width,
          height: preview.candidateNode.height,
          rx: 10,
          ry: 10,
          fill: 'none',
          stroke: 'var(--board-edge-active-color)',
          'stroke-width': 2 / options.zoom,
          'vector-effect': 'non-scaling-stroke',
          opacity: 0.9,
          style: { pointerEvents: 'none' },
        })
      : null,
    h('path', {
      d: preview.route.path,
      stroke,
      fill: 'none',
      opacity: 0.55,
      'stroke-width': options.strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke',
      'marker-end': `url(#${options.markerId})`,
      color: stroke,
      style: { pointerEvents: 'none' },
    }),
    h('circle', {
      cx: fixedEnd.point.x,
      cy: fixedEnd.point.y,
      r: options.handleRadius,
      fill: '#ffffff',
      stroke,
      'stroke-width': 1.5 / options.zoom,
      'vector-effect': 'non-scaling-stroke',
      style: { pointerEvents: 'none' },
    }),
    h('circle', {
      cx: dynamicEnd.point.x,
      cy: dynamicEnd.point.y,
      r: options.handleRadius,
      fill: '#ffffff',
      stroke: 'var(--board-edge-active-color)',
      'stroke-width': 1.5 / options.zoom,
      'vector-effect': 'non-scaling-stroke',
      style: { pointerEvents: 'none' },
    }),
  ]
}
