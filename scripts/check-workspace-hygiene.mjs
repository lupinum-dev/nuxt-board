import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(new URL('..', import.meta.url).pathname)

const forbiddenPaths = [
  'packages/board-selection',
  'packages/nuxt-board/packages',
  'packages/nuxt-board/playground/--host',
  'apps/docs/server/mcp',
]

const found = forbiddenPaths.filter((path) =>
  existsSync(resolve(rootDir, path)),
)

if (found.length > 0) {
  throw new Error(
    `Unexpected generated or zombie workspace paths found:\n${found
      .map((path) => `- ${path}`)
      .join('\n')}`,
  )
}
