import { computed, defineComponent, h, onScopeDispose, shallowRef, type ComputedRef, type PropType } from 'vue'
import type { Bounds, CanvasEngine, CanvasNode, Point } from '@canvas/core'
import { useCanvasEngine } from '@canvas/vue'

export interface MinimapOptions {
  width?: number
  height?: number
  padding?: number
}

export function useMinimap(
  engine: CanvasEngine,
  options: MinimapOptions = {}
): {
  bounds: ComputedRef<Bounds>
  viewportRect: ComputedRef<{ x: number; y: number; width: number; height: number }>
  minimapNodes: ComputedRef<Array<{ node: CanvasNode; x: number; y: number; width: number; height: number }>>
  panToMinimapPoint: (point: Point) => Promise<void>
} {
  const snapshot = shallowRef(engine.getSnapshot())
  const refresh = () => {
    snapshot.value = engine.getSnapshot()
  }
  const unsubscribes = [
    engine.on('camera:change', refresh),
    engine.on('node:created', refresh),
    engine.on('node:updated', refresh),
    engine.on('node:deleted', refresh),
    engine.on('selection:change', refresh),
    engine.on('interaction:update', refresh),
    engine.on('interaction:end', refresh)
  ]
  onScopeDispose(() => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
  })

  const width = options.width ?? 200
  const height = options.height ?? 140
  const padding = options.padding ?? 24

  const bounds = computed(() => {
    if (snapshot.value.nodes.length === 0) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 }
    }
    return {
      minX: Math.min(...snapshot.value.nodes.map((node) => node.x)) - padding,
      minY: Math.min(...snapshot.value.nodes.map((node) => node.y)) - padding,
      maxX: Math.max(...snapshot.value.nodes.map((node) => node.x + node.width)) + padding,
      maxY: Math.max(...snapshot.value.nodes.map((node) => node.y + node.height)) + padding
    }
  })

  const scale = computed(() => {
    const value = bounds.value
    return Math.min(width / Math.max(1, value.maxX - value.minX), height / Math.max(1, value.maxY - value.minY))
  })

  const minimapNodes = computed(() => {
    const value = bounds.value
    return snapshot.value.nodes.map((node) => ({
      node,
      x: (node.x - value.minX) * scale.value,
      y: (node.y - value.minY) * scale.value,
      width: Math.max(2, node.width * scale.value),
      height: Math.max(2, node.height * scale.value)
    }))
  })

  const viewportRect = computed(() => {
    const value = bounds.value
    const viewport = engine.getViewportSize()
    const visible = engine.getVisibleBounds(viewport.x, viewport.y)
    return {
      x: (visible.minX - value.minX) * scale.value,
      y: (visible.minY - value.minY) * scale.value,
      width: Math.max(6, (visible.maxX - visible.minX) * scale.value),
      height: Math.max(6, (visible.maxY - visible.minY) * scale.value)
    }
  })

  async function panToMinimapPoint(point: Point): Promise<void> {
    const world = {
      x: bounds.value.minX + point.x / scale.value,
      y: bounds.value.minY + point.y / scale.value
    }
    await engine.panTo(world, false)
  }

  return {
    bounds,
    viewportRect,
    minimapNodes,
    panToMinimapPoint
  }
}

export const CanvasMinimap = defineComponent({
  name: 'CanvasMinimap',
  props: {
    engine: {
      type: Object as PropType<CanvasEngine | null>,
      default: null
    },
    width: {
      type: Number,
      default: 200
    },
    height: {
      type: Number,
      default: 140
    }
  },
  setup(props, { slots }) {
    const injected = useCanvasEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const minimap = useMinimap(engine.value, {
      width: props.width,
      height: props.height
    })

    function onPointerDown(event: PointerEvent): void {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      void minimap.panToMinimapPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      })
    }

    return () =>
      h(
        'div',
        {
          class: 'canvas-minimap',
          style: {
            position: 'relative',
            width: `${props.width}px`,
            height: `${props.height}px`,
            overflow: 'hidden'
          },
          onPointerdown: onPointerDown
        },
        [
          slots.default
            ? slots.default({
                nodes: minimap.minimapNodes.value,
                viewport: minimap.viewportRect.value
              })
            : [
                ...minimap.minimapNodes.value.map((entry) =>
                  h('div', {
                    key: entry.node.id,
                    style: {
                      position: 'absolute',
                      left: `${entry.x}px`,
                      top: `${entry.y}px`,
                      width: `${entry.width}px`,
                      height: `${entry.height}px`,
                      border: '1px solid currentColor'
                    }
                  })
                ),
                h('div', {
                  style: {
                    position: 'absolute',
                    left: `${minimap.viewportRect.value.x}px`,
                    top: `${minimap.viewportRect.value.y}px`,
                    width: `${minimap.viewportRect.value.width}px`,
                    height: `${minimap.viewportRect.value.height}px`,
                    border: '1px solid currentColor'
                  }
                })
              ]
        ]
      )
  }
})
