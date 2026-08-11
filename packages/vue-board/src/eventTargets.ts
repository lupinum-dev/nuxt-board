const BOARD_ROOT_SELECTOR = '[data-board-root="true"]'
const BOARD_INTERACTIVE_SELECTOR = [
  '[data-board-interactive="true"]',
  '[data-editor="true"]',
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
  return Boolean(asElement(target)?.closest(BOARD_INTERACTIVE_SELECTOR))
}
