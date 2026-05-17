import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('docs honesty checks', () => {
  it('keeps group docs aligned with the actual group model', () => {
    const content = read('packages/docs/content/3.guides/2.group-nodes.md')

    expect(content).not.toContain('data.title')
    expect(content).not.toContain('center lands')
    expect(content).toContain('label')
    expect(content).toContain('fully contained')
  })

  it('keeps command guard docs on the current API name', () => {
    const content = [
      read('packages/docs/content/3.guides/6.extensions-and-middleware.md'),
      read('packages/docs/content/4.examples/6.read-only-viewer.md'),
    ].join('\n')

    expect(content).not.toContain('addMiddleware')
    expect(content).toContain('addCommandGuard')
  })
})
