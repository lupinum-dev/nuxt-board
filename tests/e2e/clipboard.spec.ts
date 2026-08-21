import { expect, test } from '@playwright/test'

test('a real Mod+V browser sequence pastes the internal buffer once', async ({
  page,
}) => {
  await page.goto('/')

  const initialCount = await page.evaluate(() => {
    const engine = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            copySelected: () => unknown[]
            getState: () => { nodes: Map<string, unknown> }
            selectAll: () => void
          }
        }
      }
    ).__boardPlayground.engine
    engine.selectAll()
    engine.copySelected()
    return engine.getState().nodes.size
  })

  const board = page.locator('.board-root').first()
  await board.focus()
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+V' : 'Control+V',
  )

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __boardPlayground: {
                engine: {
                  getState: () => { nodes: Map<string, unknown> }
                }
              }
            }
          ).__boardPlayground.engine.getState().nodes.size,
      ),
    )
    .toBe(initialCount * 2)
})
