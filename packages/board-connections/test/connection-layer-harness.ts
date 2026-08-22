import { vi } from 'vitest'

export function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  init: PointerEventInit & { pointerId?: number },
): void {
  const EventCtor = window.PointerEvent ?? window.MouseEvent
  const event = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  if (!('pointerId' in event) && init.pointerId !== undefined) {
    Object.defineProperty(event, 'pointerId', {
      configurable: true,
      value: init.pointerId,
    })
  }
  target.dispatchEvent(event)
}

export function query(selector: string): Element {
  const element = document.body.querySelector(selector)
  if (!element) throw new Error(`Missing element for selector: ${selector}`)
  return element
}

export function queryAll(selector: string): Element[] {
  return Array.from(document.body.querySelectorAll(selector))
}

export function installConnectionLayerDomHarness(): void {
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    },
    getBoundingClientRect: {
      configurable: true,
      value() {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 800,
          bottom: 600,
          width: 800,
          height: 600,
          toJSON() {
            return this
          },
        }
      },
    },
  })
}
