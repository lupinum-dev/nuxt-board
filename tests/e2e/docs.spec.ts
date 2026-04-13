import { expect, test } from '@playwright/test'

test('renders the docs landing page and embedded board demo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/')

  await expect(page.getByRole('heading', { name: /build spatial tools with vue board/i })).toBeVisible()
  await expect(page.getByText(/the docs use the real workspace packages/i)).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
})

test('navigates to examples and api reference pages', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/examples/basic-board')

  await expect(page.getByRole('heading', { name: 'Basic Board' })).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()

  await page.goto('http://127.0.0.1:4174/api/board-core')

  await expect(page.getByRole('heading', { name: '@lupinum/board-core' })).toBeVisible()
  await expect(page.getByText('createBoardEngine')).toBeVisible()
})

test('links the docs experience back to the sandbox', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/getting-started/introduction')

  const sandboxLink = page.getByRole('link', { name: /open the full sandbox on github/i })
  await expect(sandboxLink).toBeVisible()
  await expect(sandboxLink).toHaveAttribute('href', /apps\/playground/)
})
