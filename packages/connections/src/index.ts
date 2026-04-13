import { computed, defineComponent, h, shallowRef, watch, type PropType } from 'vue'
import {
  boundsIntersect,
  asEdgeId,
  type Bounds,
  type CanvasEngine,
  type CanvasNode,
  type CanvasPlugin,
  type EdgeId,
  type NodeData,
  type NodeId,
  type Point
} from '@canvas/core'
import { useCanvasEngine } from '@canvas/vue'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
export type ConnectionRouting = 'bezier' | 'step' | 'straight'

export interface AnchorPosition {
  side: AnchorSide
  offset: number
}

export interface CanvasEdge<T = Record<string, unknown>> {
  id: EdgeId
  from: NodeId
  to: NodeId
  fromAnchor?: AnchorPosition
  toAnchor?: AnchorPosition
  data: T
  zIndex: number
}

export interface ConnectionPluginOptions {
  routing?: ConnectionRouting
  defaultArrow?: 'none' | 'start' | 'end' | 'both'
  snapDistance?: number
}

export interface ConnectionsExtension {
  createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
  ): CanvasEdge<T>
  deleteEdge(id: EdgeId): void
  getEdges(): CanvasEdge[]
  getEdgesFrom(id: NodeId): CanvasEdge[]
  getEdgesTo(id: NodeId): CanvasEdge[]
  getEdgesBetween(from: NodeId, to: NodeId): CanvasEdge[]
}

declare module '@canvas/core' {
  interface CanvasEventMap<R extends import('@canvas/core').NodeTypeRegistry = import('@canvas/core').NodeTypeRegistry> {
    'edge:created': (edge: CanvasEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface CanvasEngineExtensions<R extends import('@canvas/core').NodeTypeRegistry = import('@canvas/core').NodeTypeRegistry> {
    connections: ConnectionsExtension
  }
}

function cloneEdge<T>(edge: CanvasEdge<T>): CanvasEdge<T> {
  return {
    ...edge,
    data: structuredClone(edge.data)
  }
}

export function connectionPlugin(options: ConnectionPluginOptions = {}): CanvasPlugin {
  const routing = options.routing ?? 'bezier'

  return {
    name: 'connections',
    install(engine) {
      const edges = new Map<EdgeId, CanvasEdge>()
      let nextZIndex = 1

      const api: ConnectionsExtension = {
        createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
        ) {
          if (!engine.hasNode(input.from)) {
            throw new Error(`Cannot create edge: source node "${input.from}" does not exist.`)
          }
          if (!engine.hasNode(input.to)) {
            throw new Error(`Cannot create edge: target node "${input.to}" does not exist.`)
          }
          const edge: CanvasEdge<T> = {
            id: input.id ?? asEdgeId(crypto.randomUUID()),
            from: input.from,
            to: input.to,
            fromAnchor: input.fromAnchor,
            toAnchor: input.toAnchor,
            data: structuredClone(input.data ?? ({} as T)),
            zIndex: input.zIndex ?? nextZIndex++
          }
          nextZIndex = Math.max(nextZIndex, edge.zIndex + 1)
          edges.set(edge.id, edge)
          const cloned = cloneEdge(edge)
          engine.emit('edge:created', cloned)
          return cloned
        },
        deleteEdge(id) {
          if (!edges.has(id)) {
            return
          }
          edges.delete(id)
          engine.emit('edge:deleted', id)
        },
        getEdges() {
          return Array.from(edges.values(), (edge) => cloneEdge(edge))
        },
        getEdgesFrom(id) {
          return api.getEdges().filter((edge) => edge.from === id)
        },
        getEdgesTo(id) {
          return api.getEdges().filter((edge) => edge.to === id)
        },
        getEdgesBetween(from, to) {
          return api.getEdges().filter((edge) => edge.from === from && edge.to === to)
        }
      }

      engine.extend('connections', api)
      ;(engine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting }).__routing = routing

      const unsubscribe = engine.on('node:deleted', (id) => {
        const toDelete = Array.from(edges.values()).filter((edge) => edge.from === id || edge.to === id)
        for (const edge of toDelete) {
          edges.delete(edge.id)
          engine.emit('edge:deleted', edge.id)
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }
}

export function resolveAnchorPoint(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, anchor?: AnchorPosition): Point {
  const offset = anchor?.offset ?? 0.5
  switch (anchor?.side ?? 'right') {
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

export function routeEdgePath(from: Point, to: Point, routing: ConnectionRouting = 'bezier'): string {
  if (routing === 'straight') {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
  if (routing === 'step') {
    const midX = (from.x + to.x) / 2
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`
  }
  const controlOffset = Math.max(40, Math.abs(to.x - from.x) * 0.4)
  return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`
}

export function getEdgeBounds(from: Point, to: Point): Bounds {
  return {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y)
  }
}

export function getVisibleEdges(engine: CanvasEngine, bounds: Bounds): CanvasEdge[] {
  const nodes = engine.$nodes.get()
  return engine.ext.connections.getEdges().filter((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) {
      return false
    }
    return boundsIntersect(bounds, getEdgeBounds(resolveAnchorPoint(from, edge.fromAnchor), resolveAnchorPoint(to, edge.toAnchor)))
  })
}

export const CanvasConnectionLayer = defineComponent({
  name: 'CanvasConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<CanvasEngine | null>,
      default: null
    },
    routing: {
      type: String as PropType<ConnectionRouting>,
      default: 'bezier'
    }
  },
  setup(props, { slots }) {
    const injected = useCanvasEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const version = shallowRef(0)

    let versionDirty = false
    function scheduleVersion(): void {
      if (!versionDirty) {
        versionDirty = true
        queueMicrotask(() => {
          version.value += 1
          versionDirty = false
        })
      }
    }

    watch(
      engine,
      (current, _prev, onCleanup) => {
        const unsubscribes = [
          current.on('edge:created', scheduleVersion),
          current.on('edge:deleted', scheduleVersion),
          current.$nodes.subscribe(() => scheduleVersion())
        ]
        onCleanup(() => {
          for (const unsubscribe of unsubscribes) {
            unsubscribe()
          }
        })
      },
      { immediate: true }
    )

    const paths = computed(() => {
      void version.value
      const nodes = injected.$nodes.value
      return engine.value.ext.connections.getEdges().map((edge) => {
        const from = nodes.get(edge.from)
        const to = nodes.get(edge.to)
        if (!from || !to) {
          return null
        }
        const fromPoint = resolveAnchorPoint(from, edge.fromAnchor)
        const toPoint = resolveAnchorPoint(to, edge.toAnchor)
        return {
          edge,
          from: fromPoint,
          to: toPoint,
          path: routeEdgePath(fromPoint, toPoint, props.routing)
        }
      }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    })

    return () =>
      h(
        'svg',
        {
          class: 'canvas-connection-layer',
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }
        },
        paths.value.map((entry) =>
          slots.edge
            ? slots.edge(entry)
            : h('path', { d: entry.path, stroke: 'currentColor', fill: 'none', 'stroke-width': 2 })
        )
      )
  }
})
