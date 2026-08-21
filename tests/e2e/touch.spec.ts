import { devices, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ ...devices['Pixel 7'] })

async function openBoard(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() =>
    Boolean(
      (
        window as unknown as {
          __boardPlayground?: { engine?: unknown }
        }
      ).__boardPlayground?.engine,
    ),
  )
  const closeSettings = page.getByRole('button', { name: 'Close settings' })
  if (await closeSettings.isVisible()) await closeSettings.click()
  await page.addStyleTag({
    content: '.playground-panel, main > header { display: none !important; }',
  })
}

async function emptyBoardPoint(page: Page) {
  return page.locator('.board-root').evaluate((board) => {
    const bounds = board.getBoundingClientRect()
    const candidates = Array.from({ length: 8 }, (_, column) =>
      Array.from({ length: 8 }, (_, row) => ({
        x: bounds.left + ((column + 0.5) * bounds.width) / 8,
        y: bounds.top + ((row + 0.5) * bounds.height) / 8,
      })),
    ).flat()
    const point = candidates.find(({ x, y }) => {
      const target = document.elementFromPoint(x, y)
      return (
        target instanceof Element &&
        board.contains(target) &&
        !target.closest(
          '[data-node-id], [data-board-interactive="true"], button, input, select, textarea, a[href]',
        )
      )
    })
    if (!point) throw new Error('Could not find an empty canvas point')
    return point
  })
}

test('touch tap on empty canvas clears selection', async ({ page }) => {
  await openBoard(page)
  await page.evaluate(() => {
    const engine = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            getState: () => { nodes: Map<string, { id: string }> }
            select: (id: string) => void
          }
        }
      }
    ).__boardPlayground.engine
    const node = engine.getState().nodes.values().next().value
    if (!node) throw new Error('Expected a seeded node')
    engine.select(node.id)
  })
  const point = await emptyBoardPoint(page)

  await page.touchscreen.tap(point.x, point.y)

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __boardPlayground: {
                engine: { getSelection: () => readonly string[] }
              }
            }
          ).__boardPlayground.engine.getSelection().length,
      ),
    )
    .toBe(0)
})

test('one-finger touch movement pans the canvas', async ({ context, page }) => {
  await openBoard(page)
  const point = await emptyBoardPoint(page)
  const cameraBefore = await page.evaluate(
    () =>
      (
        window as unknown as {
          __boardPlayground: {
            engine: {
              getState: () => { camera: { x: number; y: number; z: number } }
            }
          }
        }
      ).__boardPlayground.engine.getState().camera,
  )
  const session = await context.newCDPSession(page)

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: point.x, y: point.y }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: point.x + 48, y: point.y + 32 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __boardPlayground: {
                engine: {
                  getState: () => {
                    camera: { x: number; y: number; z: number }
                  }
                }
              }
            }
          ).__boardPlayground.engine.getState().camera,
      ),
    )
    .toEqual({
      ...cameraBefore,
      x: cameraBefore.x + 48 / cameraBefore.z,
      y: cameraBefore.y + 32 / cameraBefore.z,
    })
})
