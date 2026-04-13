import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function openDocs(page: Page, path = '/') {
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'commit' })
  await page.goto(`http://127.0.0.1:4174${path}`, { waitUntil: 'commit' })
  await expect(page.locator('body')).toBeVisible()
}

test('renders the docs landing page and embedded board demo', async ({ page }) => {
  await openDocs(page)

  await expect(page.getByRole('heading', { name: /build spatial tools with vue board/i })).toBeVisible()
  await expect(page.getByText(/the docs use the real workspace packages/i)).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
})

test('navigates to examples and api reference pages', async ({ page }) => {
  await openDocs(page, '/examples/basic-board')

  await expect(page.getByRole('heading', { name: 'Basic Board' })).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()

  await openDocs(page, '/api/board-core')

  await expect(page.getByRole('heading', { name: '@lupinum/board-core' })).toBeVisible()
  await expect(page.getByText('createBoardEngine')).toBeVisible()
})

test('links the docs introduction to the examples section', async ({ page }) => {
  await openDocs(page, '/getting-started/introduction')

  const examplesLink = page.getByRole('main').getByRole('link', { name: 'Examples', exact: true })
  await expect(examplesLink).toBeVisible()
  await expect(examplesLink).toHaveAttribute('href', '/examples/basic-board')
})
