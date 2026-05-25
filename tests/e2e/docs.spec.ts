import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

const pageConsoleErrors = new WeakMap<Page, string[]>()

function collectConsoleErrors(page: Page): string[] {
  const existing = pageConsoleErrors.get(page)
  if (existing) {
    return existing
  }

  const consoleErrors: string[] = []
  pageConsoleErrors.set(page, consoleErrors)
  page.on('console', (message) => {
    const text = message.text()
    if (
      text.includes('wasm streaming compile failed') ||
      text.includes('falling back to ArrayBuffer instantiation')
    ) {
      return
    }
    if (
      message.type() === 'error' ||
      text.includes('[Icon] failed to load icon')
    ) {
      consoleErrors.push(text)
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  return consoleErrors
}

async function openDocs(page: Page, path = '/') {
  const consoleErrors = collectConsoleErrors(page)
  await page.goto(`http://127.0.0.1:4174${path}`, { waitUntil: 'commit' })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toBeVisible()
  return consoleErrors
}

async function exerciseExample(
  page: Page,
  path: string,
  heading: string,
  control: string | RegExp,
) {
  const consoleErrors = await openDocs(page, path)

  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
  await page.getByRole('button', { name: control }).first().click()
  await expect(page.locator('.board-root').first()).toBeVisible()
  expect(consoleErrors).toEqual([])
}

test('renders the docs landing page and embedded board demo', async ({
  page,
}) => {
  const consoleErrors = await openDocs(page)

  await expect(
    page.getByRole('heading', { name: /build spatial tools with vue board/i }),
  ).toBeVisible()
  await expect(
    page.getByText(/the docs use the real workspace packages/i),
  ).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('navigates to examples and api reference pages', async ({ page }) => {
  const consoleErrors = await openDocs(page, '/examples/basic-board')

  await expect(page.getByRole('heading', { name: 'Basic Board' })).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
  const demo = page.getByTestId('basic-board-demo')
  await expect(demo).toHaveAttribute('data-node-count', '4')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(demo).toHaveAttribute('data-node-count', '5')

  await openDocs(page, '/api/board-core')

  await expect(
    page.getByRole('heading', { name: '@lupinum/board-core' }),
  ).toBeVisible()
  await expect(
    page.locator('#createboardengine').getByRole('link', {
      name: 'createBoardEngine',
    }),
  ).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('exercises every examples demo without console errors', async ({
  page,
}) => {
  await exerciseExample(
    page,
    '/examples/basic-board',
    'Basic Board',
    'Add note',
  )
  await exerciseExample(
    page,
    '/examples/connections-and-minimap',
    'Connections and Minimap',
    'Shuffle',
  )
  await exerciseExample(
    page,
    '/examples/custom-renderers',
    'Custom Renderers',
    'Add insight',
  )
  await exerciseExample(
    page,
    '/examples/workflow-builder',
    'Workflow Renderer Demo',
    'Cycle selected step',
  )
  await exerciseExample(page, '/examples/mind-map', 'Mind Map', 'Add branch')
  await exerciseExample(
    page,
    '/examples/read-only-viewer',
    'Read-only Viewer',
    'Switch to edit mode',
  )
  await exerciseExample(
    page,
    '/examples/nuxt-auto-imports',
    'Nuxt Auto-imports',
    'Add node',
  )
})

test('links the docs introduction to the examples section', async ({
  page,
}) => {
  const consoleErrors = await openDocs(page, '/getting-started/introduction')

  const examplesLink = page
    .getByRole('main')
    .getByRole('link', { name: 'Examples', exact: true })
  await expect(examplesLink).toBeVisible()
  await expect(examplesLink).toHaveAttribute('href', '/examples/basic-board')
  expect(consoleErrors).toEqual([])
})

test('keeps markdown action links aligned after client navigation', async ({
  page,
}) => {
  const consoleErrors = await openDocs(page, '/getting-started/introduction')
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Examples', exact: true })
    .click()
  await expect(page).toHaveURL(/\/examples\/basic-board$/)
  await expect(page.getByRole('heading', { name: 'Basic Board' })).toBeVisible({
    timeout: 15_000,
  })

  const menuButton = page.getByTestId('page-actions-menu')
  await expect(async () => {
    await menuButton.click()
    await expect(
      page.getByRole('menu', { name: 'Open copy actions menu' }),
    ).toBeVisible({
      timeout: 500,
    })
  }).toPass({ timeout: 10_000 })
  const chatGptHref = await page
    .getByRole('menuitem', { name: 'Open in ChatGPT' })
    .getAttribute('href')
  const claudeHref = await page
    .getByRole('menuitem', { name: 'Open in Claude' })
    .getAttribute('href')
  const markdownHref = await page
    .getByRole('menuitem', { name: 'View as Markdown' })
    .getAttribute('href')
  const expectedMarkdownUrl =
    'http://127.0.0.1:4174/raw/examples/basic-board.md'

  expect(markdownHref).toBe('/raw/examples/basic-board.md')
  expect(decodeURIComponent(chatGptHref ?? '')).toContain(expectedMarkdownUrl)
  expect(decodeURIComponent(claudeHref ?? '')).toContain(expectedMarkdownUrl)
  expect(consoleErrors).toEqual([])
})
