import { describe, expect, it } from 'vitest'
import { isConsumedPrereleaseVersion } from '../scripts/check-release-notes.mjs'

const packagePaths = [
  'packages/board-core/package.json',
  'packages/vue-board/package.json',
]
const generatedPaths = ['.changeset/pre.json', 'CHANGELOG.md', ...packagePaths]

function candidate(
  overrides: Partial<Parameters<typeof isConsumedPrereleaseVersion>[0]> = {},
) {
  return {
    tag: 'beta',
    versions: ['1.0.0-beta.0', '1.0.0-beta.0'],
    baseVersions: ['0.1.0', '0.1.0'],
    consumedChangesets: ['core-contract', 'vue-api'],
    changesetIds: ['core-contract', 'vue-api'],
    changedPaths: generatedPaths,
    packagePaths,
    changelog: '# Changelog\n\n## v1.0.0-beta.0\n',
    ...overrides,
  }
}

describe('release notes verification', () => {
  it('accepts a generated prerelease after every changeset is consumed', () => {
    expect(isConsumedPrereleaseVersion(candidate())).toBe(true)
  })

  it('rejects a prerelease with an unconsumed changeset', () => {
    expect(
      isConsumedPrereleaseVersion(
        candidate({ changesetIds: ['core-contract', 'missing-notes'] }),
      ),
    ).toBe(false)
  })

  it('rejects source changes hidden inside a version pull request', () => {
    expect(
      isConsumedPrereleaseVersion(
        candidate({
          changedPaths: [...generatedPaths, 'packages/board-core/src/index.ts'],
        }),
      ),
    ).toBe(false)
  })
})
