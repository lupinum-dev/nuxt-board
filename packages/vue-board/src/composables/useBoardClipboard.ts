import type { Ref } from 'vue'
import type { BoardEngine, Point } from '@lupinum/board-core'
import { runBoardCommand } from './runBoardCommand.js'
import {
  isBoardInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '../eventTargets.js'

interface UseBoardClipboardOptions {
  engine: BoardEngine
  rootElement: Ref<HTMLElement | null>
}

/** Let the browser paste event own external parsing and internal fallback. */
export function useBoardClipboard(options: UseBoardClipboardOptions) {
  const { engine, rootElement } = options

  function onPaste(event: ClipboardEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    const data = event.clipboardData
    const payload = {
      text: data?.getData('text/plain') ?? '',
      files: Array.from(data?.files ?? []),
    }
    const viewport = rootElement.value
    const offset: Point | undefined = viewport
      ? engine.screenToWorld({
          x: viewport.clientWidth / 2,
          y: viewport.clientHeight / 2,
        })
      : undefined
    const external = runBoardCommand(() => engine.pasteData(payload, offset))
    if (external && external.length > 0) {
      event.preventDefault()
      return
    }
    const internal = runBoardCommand(() => engine.pasteClipboard())
    if (internal && internal.length > 0) event.preventDefault()
  }

  return { onPaste }
}
