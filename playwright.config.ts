import { defineConfig } from '@playwright/test'

const webServerEnv = { FORCE_COLOR: '0' }
const docsWebServerEnv = {
  ...webServerEnv,
  NUXT_PUBLIC_SITE_URL: 'http://127.0.0.1:4174/',
}

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: [
    {
      command:
        'pnpm --filter @lupinum/board-playground dev --host 127.0.0.1 --port 4173',
      env: webServerEnv,
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter docs dev --host 127.0.0.1 --port 4174',
      env: docsWebServerEnv,
      port: 4174,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        'pnpm --filter nuxt-board-playground dev --host 127.0.0.1 --port 4175',
      env: webServerEnv,
      port: 4175,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
