import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { BoardEngine, GridSettings } from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'

/** Options for wiring keyboard shortcuts to a board engine instance. */
interface UseKeyboardShortcutsOptions {
  engine: BoardEngine
  grid: Ref<GridSettings>
  spacePressed: Ref<boolean>
}

function shouldIgnoreHotkeys(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * Provide the keyboard handlers used by `BoardRoot`.
 *
 * Shortcuts cover selection, clipboard commands, history, zoom presets, and
 * keyboard nudging while intentionally ignoring editable targets.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { engine, grid, spacePressed } = options
  const interaction = getBoardInteractionAdapter(engine)

  function clearTransientKeys(): void {
    spacePressed.value = false
  }

  onMounted(() => {
    window.addEventListener('blur', clearTransientKeys)
    document.addEventListener('visibilitychange', clearTransientKeys)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('blur', clearTransientKeys)
    document.removeEventListener('visibilitychange', clearTransientKeys)
  })

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !shouldIgnoreHotkeys(event)) {
      event.preventDefault()
      spacePressed.value = true
    }
    if (shouldIgnoreHotkeys(event)) return

    const mod = event.metaKey || event.ctrlKey
    const selection = engine.getSelection()
    const history = (
      engine.plugins as unknown as {
        history?: { undo: () => void; redo: () => void }
      }
    ).history
    if (event.key === 'Escape') {
      engine.clearSelection()
      interaction.endInteraction()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selection.length > 0) {
        event.preventDefault()
        engine.deleteSelected()
      }
      return
    }
    if (event.key === 'Enter' && selection.length === 1) {
      engine.beginTextEdit(selection[0]!)
      return
    }
    if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      engine.selectAll()
      return
    }
    if (mod && event.key.toLowerCase() === 'd' && selection.length > 0) {
      event.preventDefault()
      engine.duplicateNodes(selection)
      return
    }
    if (mod && event.key.toLowerCase() === 'c' && selection.length > 0) {
      event.preventDefault()
      engine.copySelected()
      return
    }
    if (mod && event.key.toLowerCase() === 'v') {
      event.preventDefault()
      engine.pasteClipboard()
      return
    }
    if (mod && event.key === '0') {
      event.preventDefault()
      void engine.zoomTo(1, true)
      return
    }
    if (mod && event.key === '1') {
      event.preventDefault()
      void engine.zoomToFit(40, true)
      return
    }
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) {
        history?.redo()
      } else {
        history?.undo()
      }
      return
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      history?.redo()
      return
    }
    if (selection.length > 0 && event.key.startsWith('Arrow')) {
      event.preventDefault()
      const step = event.shiftKey
        ? grid.value.size * grid.value.majorEvery
        : grid.value.size
      const delta =
        event.key === 'ArrowLeft'
          ? { x: -step, y: 0 }
          : event.key === 'ArrowRight'
            ? { x: step, y: 0 }
            : event.key === 'ArrowUp'
              ? { x: 0, y: -step }
              : { x: 0, y: step }
      engine.translateSelectedNodes(delta.x, delta.y)
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      clearTransientKeys()
    }
  }

  return { onKeyDown, onKeyUp }
}
