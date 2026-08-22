export const BOARD_ROOT_ATTRIBUTE = 'data-board-root'
export const BOARD_ROOT_SELECTOR = `[${BOARD_ROOT_ATTRIBUTE}="true"]`
export const BOARD_INTERACTIVE_ATTRIBUTE = 'data-board-interactive'
export const BOARD_INTERACTIVE_SELECTOR = `[${BOARD_INTERACTIVE_ATTRIBUTE}="true"]`
export const BOARD_EDITOR_ATTRIBUTE = 'data-editor'
export const BOARD_NODE_ID_ATTRIBUTE = 'data-node-id'
export const BOARD_RESIZE_ATTRIBUTE = 'data-resize'

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
  return typeof Element !== 'undefined' && target instanceof Element
    ? target
    : null
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

/** Whether native editable or explicitly interactive content owns an event. */
export function isBoardInteractiveEventTarget(
  target: EventTarget | null,
  options: { allowResizeHandle?: boolean } = {},
): boolean {
  const element = asElement(target)
  if (
    options.allowResizeHandle &&
    element?.closest(`[${BOARD_RESIZE_ATTRIBUTE}]`)
  ) {
    return false
  }
  return Boolean(element?.closest(BOARD_INTERACTIVE_TARGET_SELECTOR))
}
