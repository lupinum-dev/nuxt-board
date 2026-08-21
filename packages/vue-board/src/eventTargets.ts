import {
  BOARD_NODE_ID_ATTRIBUTE,
  BOARD_RESIZE_ATTRIBUTE,
  isBoardInteractiveEventTarget as isCoreInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '@lupinum/board-core/internal'
import type { ResizeHandle } from '@lupinum/board-core'

/** Whether a bubbled DOM event belongs to this board rather than a nested root. */
export { isEventOwnedByBoardRoot }

/** Whether an embedded editor or screen-space control owns the event. */
export function isBoardInteractiveEventTarget(
  target: EventTarget | null,
): boolean {
  return isCoreInteractiveEventTarget(target, { allowResizeHandle: true })
}

export function findBoardNodeId(
  target: EventTarget | null,
): string | undefined {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>(`[${BOARD_NODE_ID_ATTRIBUTE}]`)?.dataset
        .nodeId
    : undefined
}

export function findBoardResizeHandle(
  target: EventTarget | null,
): ResizeHandle | undefined {
  return target instanceof HTMLElement
    ? (target.closest<HTMLElement>(`[${BOARD_RESIZE_ATTRIBUTE}]`)?.dataset
        .resize as ResizeHandle | undefined)
    : undefined
}
