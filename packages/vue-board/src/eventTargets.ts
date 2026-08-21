import {
  BOARD_EDITOR_ATTRIBUTE,
  BOARD_INTERACTIVE_SELECTOR,
  BOARD_RESIZE_ATTRIBUTE,
  BOARD_ROOT_SELECTOR,
} from '@lupinum/board-core/internal'

const BOARD_INTERACTIVE_TARGET_SELECTOR = [
  BOARD_INTERACTIVE_SELECTOR,
  `[${BOARD_EDITOR_ATTRIBUTE}="true"]`,
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null
}

/** Whether a bubbled DOM event belongs to this board rather than a nested root. */
export function isEventOwnedByBoardRoot(
  target: EventTarget | null,
  root: HTMLElement | null,
): boolean {
  const element = asElement(target)
  return Boolean(
    element && root && element.closest(BOARD_ROOT_SELECTOR) === root,
  )
}

/** Whether an embedded editor or screen-space control owns the event. */
export function isBoardInteractiveEventTarget(
  target: EventTarget | null,
): boolean {
  const element = asElement(target)
  if (element?.closest(`[${BOARD_RESIZE_ATTRIBUTE}]`)) return false
  return Boolean(element?.closest(BOARD_INTERACTIVE_TARGET_SELECTOR))
}
