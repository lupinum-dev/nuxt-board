import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { BoardEngine, Point } from '@lupinum/board-core'

/** Inputs for tracking the rendered board viewport size. */
export interface UseViewportSizeOptions {
  rootElement: Ref<HTMLElement | null>
  engine: BoardEngine
}

/** Observe the root element size and mirror it into the engine viewport state. */
export function useViewportSize(options: UseViewportSizeOptions) {
  const viewportSize = ref<Point>({ x: 0, y: 0 })
  let resizeObserver: ResizeObserver | null = null

  function updateViewportSize(): void {
    const rect = options.rootElement.value?.getBoundingClientRect()
    viewportSize.value = {
      x: rect?.width ?? 0,
      y: rect?.height ?? 0,
    }
    options.engine.setViewportSize(viewportSize.value)
  }

  onMounted(() => {
    updateViewportSize()
    if (options.rootElement.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateViewportSize)
      resizeObserver.observe(options.rootElement.value)
    } else {
      window.addEventListener('resize', updateViewportSize)
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    } else {
      window.removeEventListener('resize', updateViewportSize)
    }
  })

  return { viewportSize, updateViewportSize }
}
