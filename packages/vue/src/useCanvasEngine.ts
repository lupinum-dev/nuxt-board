import { inject } from 'vue'
import { canvasEngineKey } from './context'

export function useCanvasEngine() {
  const context = inject(canvasEngineKey)
  if (!context) {
    throw new Error('useCanvasEngine must be used under <CanvasRoot>.')
  }
  return context
}
