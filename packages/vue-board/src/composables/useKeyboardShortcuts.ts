import type { Ref } from 'vue'
import type { BoardEngine, BoardSnapshot } from '@lupinum/board-core'

export interface UseKeyboardShortcutsOptions {
  engine: BoardEngine
  snapshot: Ref<BoardSnapshot>
  spacePressed: Ref<boolean>
}

function shouldIgnoreHotkeys(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { engine, snapshot, spacePressed } = options

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !shouldIgnoreHotkeys(event)) {
      event.preventDefault()
      spacePressed.value = true
    }
    if (shouldIgnoreHotkeys(event)) return

    const mod = event.metaKey || event.ctrlKey
    const selection = engine.getSelection()
    const history = (
      engine.ext as unknown as {
        history?: { undo: () => void; redo: () => void }
      }
    ).history
    if (event.key === 'Escape') {
      engine.clearSelection()
      engine.endInteraction()
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
        ? snapshot.value.grid.size * snapshot.value.grid.majorEvery
        : snapshot.value.grid.size
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
      spacePressed.value = false
    }
  }

  return { onKeyDown, onKeyUp }
}
