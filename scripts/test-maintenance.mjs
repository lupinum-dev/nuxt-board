import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { checkDependencyPolicy } from './check-dependency-policy.mjs'

const policy =
  'minimumReleaseAge: 1440\nminimumReleaseAgeStrict: true\nminimumReleaseAgeIgnoreMissingTime: false\n'
const now = Date.parse('2026-09-06T12:00:00Z')
const exception = (expires) =>
  `${policy}minimumReleaseAgeExclude:\n  - 'example@1.2.3' # ${JSON.stringify({ reason: 'Reviewed fix', owner: 'mat4m0', expires })}\n`
assert.deepEqual(checkDependencyPolicy(policy, now), [])
assert.deepEqual(
  checkDependencyPolicy(exception('2026-09-06T13:00:00Z'), now),
  [],
)
for (const [source, error] of [
  [exception('2026-09-06T12:00:00Z'), /expired/],
  [exception('2026-09-08T12:00:00Z'), /within 24 hours/],
  [exception('2026-02-30T12:00:00Z'), /valid UTC/],
  [
    exception('2026-09-06T13:00:00Z').replace('example@1.2.3', 'example@*'),
    /exact/,
  ],
  [policy.replace('1440', '0'), /1440/],
  [`${policy}minimumReleaseAge: 1440\n`, /unique/],
])
  assert.match(checkDependencyPolicy(source, now).join('\n'), error)

const fixture = mkdtempSync(join(tmpdir(), 'board-policy-'))
try {
  const path = join(fixture, 'pnpm-workspace.yaml')
  const run = () =>
    spawnSync(process.execPath, ['scripts/check-dependency-policy.mjs', path], {
      encoding: 'utf8',
    })
  writeFileSync(path, policy)
  assert.equal(run().status, 0)
  writeFileSync(path, exception('2020-01-01T00:00:00Z'))
  const expired = run()
  assert.equal(expired.status, 1)
  assert.match(expired.stderr, /expired/)
} finally {
  rmSync(fixture, { recursive: true, force: true })
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
const select = ci.jobs.classify.steps.find((step) => step.id === 'paths').with
  .script
const classify = new (Object.getPrototypeOf(async function () {}).constructor)(
  'context',
  'github',
  'core',
  select,
)
for (const [eventName, paths, expected] of [
  ['push', [], 'true'],
  ['pull_request', ['docs/content/docs/example.md'], 'false'],
  ['pull_request', ['MAINTAINING.md'], 'false'],
  ['pull_request', ['docs/content/helper.ts'], 'true'],
  ['pull_request', ['package.json'], 'true'],
  [
    'pull_request',
    [
      {
        filename: 'README.md',
        previous_filename: 'packages/board-core/src/index.ts',
      },
    ],
    'true',
  ],
  [
    'pull_request',
    ['docs/content/docs/example.md', 'packages/board-core/src/index.ts'],
    'true',
  ],
  ['pull_request', ['docs/nuxt.config.ts'], 'true'],
  ['pull_request', ['unknown-file'], 'true'],
  ['pull_request', [], 'true'],
]) {
  let output
  await classify(
    { eventName, repo: {}, issue: {} },
    {
      rest: { pulls: { listFiles() {} } },
      paginate: async () =>
        paths.map((file) =>
          typeof file === 'string' ? { filename: file } : file,
        ),
    },
    {
      setOutput: (name, value) => {
        assert.equal(name, 'full')
        output = value
      },
    },
  )
  assert.equal(output, expected)
}
assert.equal(ci.jobs.docs.if, "needs.classify.outputs.full == 'false'")
assert.equal(ci.jobs.docs.steps.at(-1).run, 'pnpm verify:docs')
assert.equal(ci.jobs.gate.if, 'always()')
assert.ok(ci.jobs.gate.needs.includes('docs'))
assert.deepEqual(ci.jobs.gate.steps.at(-1).env, {
  CLASSIFY_RESULT: '${{ needs.classify.result }}',
  FULL: '${{ needs.classify.outputs.full }}',
  CHECKS_RESULT: '${{ needs.checks.result }}',
  VISUAL_RESULT: '${{ needs.visual-regression.result }}',
  DOCS_RESULT: '${{ needs.docs.result }}',
})
const gate = ci.jobs.gate.steps.at(-1).run
const runGate = (env) =>
  spawnSync('bash', ['-e', '-c', gate], { env: { ...process.env, ...env } })
    .status
const full = {
  CLASSIFY_RESULT: 'success',
  FULL: 'true',
  CHECKS_RESULT: 'success',
  VISUAL_RESULT: 'success',
  DOCS_RESULT: 'skipped',
}
const docs = {
  ...full,
  FULL: 'false',
  CHECKS_RESULT: 'skipped',
  VISUAL_RESULT: 'skipped',
  DOCS_RESULT: 'success',
}
assert.equal(runGate(full), 0)
assert.equal(runGate(docs), 0)
for (const status of ['failure', 'cancelled', 'skipped']) {
  assert.notEqual(runGate({ ...docs, DOCS_RESULT: status }), 0)
  assert.notEqual(runGate({ ...full, CHECKS_RESULT: status }), 0)
  assert.notEqual(runGate({ ...full, VISUAL_RESULT: status }), 0)
  assert.notEqual(runGate({ ...full, CLASSIFY_RESULT: status }), 0)
}
assert.notEqual(runGate({ ...docs, FULL: '' }), 0)
assert.notEqual(runGate({ ...docs, FULL: 'unknown' }), 0)
const daily = parse(
  readFileSync('.github/workflows/dependency-policy.yml', 'utf8'),
)
assert.equal(daily.on.schedule[0].cron, '23 4 * * *')
assert.deepEqual(
  daily.jobs.expiry.steps.flatMap((step) => step.run ?? []),
  [
    'pnpm install --frozen-lockfile --ignore-scripts',
    'node scripts/check-dependency-policy.mjs',
  ],
)
console.log(
  'Maintenance checks passed: expiry, generated policy CLI, CI lane selection and failure propagation.',
)
