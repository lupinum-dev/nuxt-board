import { describe, expect, it } from 'vitest'
import {
  extractGeneratedRelease,
  mergeReleaseSection,
} from '../scripts/changelog-utils.mjs'

describe('changelog generation', () => {
  it('ignores Changelogen status output before the first Markdown release section', () => {
    const stdout = [
      'ℹ No previous git tag found',
      'ℹ Generated changes from the complete history',
      '## Unreleased',
      '',
      '### Features',
      '',
      '- add boards',
    ].join('\n')

    expect(extractGeneratedRelease(stdout, '0.1.0')).toBe(
      '## v0.1.0\n\n### Features\n\n- add boards',
    )
  })

  it('accepts output generated before the repository has a release tag', () => {
    const stdout = '## 0.1.0\n\n### Changes\n\n- first release\n'
    expect(extractGeneratedRelease(stdout, '0.1.0')).toBe(
      '## v0.1.0\n\n### Changes\n\n- first release',
    )
  })

  it('preserves curated notes for a version that already exists', () => {
    const current =
      '# Changelog\n\n## v0.1.0\n\nOld notes.\n\n## v0.0.1\n\nEarlier notes.\n'
    const generated = '## v0.1.0\n\nNew notes.'

    expect(mergeReleaseSection(current, generated, '0.1.0')).toBe(
      '# Changelog\n\n## v0.1.0\n\nOld notes.\n\n## v0.0.1\n\nEarlier notes.\n',
    )
  })

  it('adds generated notes when the version does not exist', () => {
    const current = '# Changelog\n\n## v0.1.0\n\nFirst release.\n'
    const generated = '## v0.2.0\n\n### Features\n\n- add exports'

    expect(mergeReleaseSection(current, generated, '0.2.0')).toBe(
      '# Changelog\n\n## v0.1.0\n\nFirst release.\n\n## v0.2.0\n\n### Features\n\n- add exports\n',
    )
  })
})
