import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  onScopeDispose,
  shallowRef,
  type ComputedRef,
  type PropType,
} from 'vue'
import {
  getVisibleBounds,
  type Bounds,
  type BoardEngine,
  type BoardNode,
  type Point,
} from '@lupinum/board-core'
import { useBoardEngine } from './useBoardEngine.js'

/** Sizing options for the minimap composable and component. */
export interface MinimapOptions {
  width?: number
  height?: number
  padding?: number
}

/**
 * Project board content and the active viewport into minimap coordinates.
 *
 * Returns derived node rectangles, the current viewport rectangle, and a
 * helper that pans the main board camera from minimap pointer input.
 */
export function useMinimap(
  engine: BoardEngine,
  options: MinimapOptions = {},
): {
  bounds: ComputedRef<Bounds>
  viewportRect: ComputedRef<{
    x: number
    y: number
    width: number
    height: number
  }>
  minimapNodes: ComputedRef<
    Array<{
      node: BoardNode
      x: number
      y: number
      width: number
      height: number
    }>
  >
  panToMinimapPoint: (point: Point) => Promise<void>
} {
  const camera = shallowRef(engine.$camera.get())
  const nodes = shallowRef(engine.$nodes.get())
  const viewportSize = shallowRef(engine.getViewportSize())
  const unsubscribes: Array<() => void> = []

  function subscribeToEngine(): void {
    unsubscribes.push(
      engine.$camera.subscribe((value) => {
        camera.value = value
      }),
      engine.$nodes.subscribe((value) => {
        nodes.value = value
      }),
      engine.on('viewport:change', (value) => {
        viewportSize.value = value
      }),
    )
    camera.value = engine.$camera.get()
    nodes.value = engine.$nodes.get()
    viewportSize.value = engine.getViewportSize()
  }

  if (getCurrentInstance()) {
    onMounted(subscribeToEngine)
  } else {
    subscribeToEngine()
  }
  onScopeDispose(() => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
  })

  const width = options.width ?? 200
  const height = options.height ?? 140
  const padding = options.padding ?? 24

  const bounds = computed(() => {
    let hasNodes = false
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of nodes.value.values()) {
      hasNodes = true
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    }

    if (!hasNodes) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 }
    }

    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    }
  })

  const scale = computed(() => {
    const value = bounds.value
    return Math.min(
      width / Math.max(1, value.maxX - value.minX),
      height / Math.max(1, value.maxY - value.minY),
    )
  })

  const offset = computed(() => {
    const value = bounds.value
    const contentWidth = (value.maxX - value.minX) * scale.value
    const contentHeight = (value.maxY - value.minY) * scale.value
    return {
      x: (width - contentWidth) / 2,
      y: (height - contentHeight) / 2,
    }
  })

  const minimapNodes = computed(() => {
    const value = bounds.value
    const off = offset.value
    return Array.from(nodes.value.values()).map((node) => ({
      node,
      x: (node.x - value.minX) * scale.value + off.x,
      y: (node.y - value.minY) * scale.value + off.y,
      width: Math.max(2, node.width * scale.value),
      height: Math.max(2, node.height * scale.value),
    }))
  })

  const viewportRect = computed(() => {
    const value = bounds.value
    const off = offset.value
    const visible = getVisibleBounds(
      viewportSize.value.x,
      viewportSize.value.y,
      camera.value,
    )
    return {
      x: (visible.minX - value.minX) * scale.value + off.x,
      y: (visible.minY - value.minY) * scale.value + off.y,
      width: Math.max(6, (visible.maxX - visible.minX) * scale.value),
      height: Math.max(6, (visible.maxY - visible.minY) * scale.value),
    }
  })

  async function panToMinimapPoint(point: Point): Promise<void> {
    const currentCamera = camera.value
    const off = offset.value
    const world = {
      x:
        bounds.value.minX +
        (point.x - off.x) / scale.value -
        viewportSize.value.x / (2 * currentCamera.z),
      y:
        bounds.value.minY +
        (point.y - off.y) / scale.value -
        viewportSize.value.y / (2 * currentCamera.z),
    }
    await engine.panTo(world, false)
  }

  return {
    bounds,
    viewportRect,
    minimapNodes,
    panToMinimapPoint,
  }
}

/** Render a clickable, draggable minimap for the current board engine. */
export const BoardMinimap = defineComponent({
  name: 'BoardMinimap',
  props: {
    engine: {
      type: Object as PropType<BoardEngine | null>,
      default: null,
    },
    width: {
      type: Number,
      default: 200,
    },
    height: {
      type: Number,
      default: 140,
    },
  },
  setup(props, { slots }) {
    const engine = props.engine ?? useBoardEngine().engine
    const minimap = useMinimap(engine, {
      width: props.width,
      height: props.height,
    })

    let activePointerId: number | null = null
    let detachDragListeners = () => undefined

    onScopeDispose(() => {
      detachDragListeners()
    })

    function getMinimapPoint(element: HTMLElement, event: PointerEvent): Point {
      const rect = element.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    function onPointerDown(event: PointerEvent): void {
      event.stopPropagation()
      const element = event.currentTarget as HTMLElement
      element.setPointerCapture?.(event.pointerId)
      activePointerId = event.pointerId
      void minimap.panToMinimapPoint(getMinimapPoint(element, event))

      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerId) {
          return
        }
        void minimap.panToMinimapPoint(getMinimapPoint(element, moveEvent))
      }

      const handleUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== activePointerId) {
          return
        }
        element.releasePointerCapture?.(upEvent.pointerId)
        activePointerId = null
        detachDragListeners()
      }

      detachDragListeners()
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      detachDragListeners = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
      }
    }

    return () =>
      h(
        'div',
        {
          class: 'board-minimap',
          'data-board-interactive': 'true',
          style: {
            position: 'relative',
            width: `${props.width}px`,
            height: `${props.height}px`,
            overflow: 'hidden',
          },
          onPointerdown: onPointerDown,
        },
        [
          slots.default
            ? slots.default({
                nodes: minimap.minimapNodes.value,
                viewport: minimap.viewportRect.value,
              })
            : [
                h(
                  'svg',
                  {
                    width: props.width,
                    height: props.height,
                    viewBox: `0 0 ${props.width} ${props.height}`,
                    style: { display: 'block' },
                    'aria-hidden': 'true',
                  },
                  [
                    h('path', {
                      d: minimap.minimapNodes.value
                        .map(
                          (entry) =>
                            `M${entry.x},${entry.y}h${entry.width}v${entry.height}h-${entry.width}Z`,
                        )
                        .join(''),
                      fill: 'currentColor',
                      opacity: 0.22,
                      stroke: 'currentColor',
                      'stroke-width': 0.75,
                    }),
                    h('rect', {
                      x: minimap.viewportRect.value.x,
                      y: minimap.viewportRect.value.y,
                      width: minimap.viewportRect.value.width,
                      height: minimap.viewportRect.value.height,
                      fill: 'none',
                      stroke: 'currentColor',
                      'stroke-width': 1,
                    }),
                  ],
                ),
              ],
        ],
      )
  },
})
