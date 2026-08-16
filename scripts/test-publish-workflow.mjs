import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const workflow = readFileSync(
  new URL('../.github/workflows/publish.yml', import.meta.url),
  'utf8',
)
const packageManifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
assert(
  /^pnpm@(?:1[1-9]|[2-9]\d)\./u.test(packageManifest.packageManager ?? ''),
  'pnpm 11 or newer is required for strict dependency quarantine.',
)
const ciWorkflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
for (const workflowPath of ['ci.yml', 'package-preview.yml', 'release.yml']) {
  const workflowSource = readFileSync(
    new URL(`../.github/workflows/${workflowPath}`, import.meta.url),
    'utf8',
  )
  assert(
    !/pnpm\/action-setup@[\s\S]{0,200}\n\s+version:/u.test(workflowSource),
    `${workflowPath} must use the packageManager version as the single pnpm source of truth.`,
  )
  const setupCount = workflowSource.match(/pnpm\/action-setup@/gu)?.length ?? 0
  const standaloneCount =
    workflowSource.match(/standalone:\s+true/gu)?.length ?? 0
  assert(
    setupCount === standaloneCount,
    `${workflowPath} must use standalone pnpm for the Node 20 compatibility lane.`,
  )
}
assert(
  ciWorkflow.includes('node scripts/verify-action-shas.mjs'),
  'CI must verify pinned Action commits upstream.',
)
assert(
  !ciWorkflow.includes('GITHUB_TOKEN'),
  'Action verification must not receive GITHUB_TOKEN.',
)
const workspacePolicy = readFileSync(
  new URL('../pnpm-workspace.yaml', import.meta.url),
  'utf8',
)
const renovate = JSON.parse(
  readFileSync(new URL('../renovate.json', import.meta.url), 'utf8'),
)
for (const policy of [
  'minimumReleaseAge: 1440',
  'minimumReleaseAgeStrict: true',
  'minimumReleaseAgeIgnoreMissingTime: false',
]) {
  assert(
    workspacePolicy.includes(policy),
    `pnpm-workspace.yaml is missing: ${policy}`,
  )
}
assert(
  renovate.minimumReleaseAge === '1 day',
  'Renovate must match the 24-hour pnpm quarantine.',
)
const publishJob = /^  publish:\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n)/m.exec(
  workflow,
)?.[1]
assert(publishJob, 'publish.yml is missing the isolated publish job.')
assert(
  publishJob.includes('environment: npm'),
  'The publish job must use the npm environment.',
)
assert(
  publishJob.includes('id-token: write'),
  'The publish job must use trusted publishing.',
)
for (const forbidden of [
  'actions/checkout@',
  'npm install',
  'pnpm install',
  'node scripts/',
]) {
  assert(
    !publishJob.includes(forbidden),
    `The publish job must not contain ${forbidden}.`,
  )
}

const releaseJob = /^  github-release:\n([\s\S]*)$/m.exec(workflow)?.[1]
assert(releaseJob, 'publish.yml is missing GitHub release creation.')
assert(
  releaseJob.includes(
    'This first npm version was created from the exact CI-certified artifact',
  ),
  'Bootstrap releases must record the missing first-version provenance.',
)
assert(
  publishJob.includes('const verifiedPackages = new Set()'),
  'The package set must share one registry polling budget.',
)
assert(
  !publishJob.includes('let verified = false'),
  'The registry polling budget must not restart for each package.',
)
assert(
  publishJob.includes('if (attempt + 1 < pollAttempts)'),
  'The registry poller must not sleep after its final attempt.',
)

const publishLines = publishJob.split('\n')
const publishStart = publishLines.findIndex((line) =>
  line.includes("node - <<'NODE'"),
)
const publishEnd = publishLines.findIndex(
  (line, index) => index > publishStart && line.trim() === 'NODE',
)
assert(
  publishStart >= 0 && publishEnd > publishStart,
  'The publish job must contain one inline Node program.',
)
const publishScript = dedent(
  publishLines.slice(publishStart + 1, publishEnd).join('\n'),
)

const packageNames = [
  '@lupinum/board-core',
  '@lupinum/vue-board',
  '@lupinum/board-history',
  '@lupinum/board-connections',
  '@lupinum/nuxt-board',
]

runScenario('matching bootstrap bytes', {
  allowBootstrap: true,
  existing: packageNames,
  expectedBootstrap: true,
  expectedModes: Object.fromEntries(
    packageNames.map((name) => [name, 'bootstrap']),
  ),
  expectedPublishes: 0,
})
runScenario('missing packages use OIDC', {
  expectedBootstrap: false,
  expectedModes: Object.fromEntries(packageNames.map((name) => [name, 'oidc'])),
  expectedPublishes: 5,
})
runScenario('mixed package sets recover safely', {
  allowBootstrap: true,
  existing: packageNames.slice(0, 2),
  expectedBootstrap: true,
  expectedModes: Object.fromEntries(
    packageNames.map((name, index) => [name, index < 2 ? 'bootstrap' : 'oidc']),
  ),
  expectedPublishes: 3,
})
runScenario('different bytes fail', {
  existing: packageNames,
  differentBytes: packageNames[0],
  expectedError: 'exists with different bytes',
})
runScenario('wrong dist-tags fail', {
  existing: packageNames,
  attested: packageNames,
  wrongTag: packageNames[4],
  expectedError: 'did not expose the required bytes',
})
runScenario('later provenance-free versions fail', {
  allowBootstrap: true,
  existing: packageNames,
  extraVersion: packageNames[0],
  expectedError: 'is not the first package version and has no provenance',
})
runScenario('a bootstrap package must remain the sole version', {
  allowBootstrap: true,
  existing: packageNames,
  laterVersionDuringVerification: packageNames[0],
  expectedError: 'did not expose the required bytes',
})
runScenario('bootstrap recovery requires explicit authorization', {
  existing: packageNames,
  expectedError: 'requires explicit bootstrap authorization',
})
runScenario('new provenance-free publications fail', {
  publishProvenance: false,
  expectedError: 'did not expose the required bytes',
})

process.stdout.write('Publish recovery policy verified.\n')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function dedent(value) {
  const lines = value.split('\n')
  const indentation = Math.min(
    ...lines.filter(Boolean).map((line) => line.match(/^\s*/)[0].length),
  )
  return lines.map((line) => line.slice(indentation)).join('\n')
}

function runScenario(name, options) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-board-release-policy-'))
  try {
    const releaseDir = join(root, '.release')
    const binDir = join(root, 'bin')
    mkdirSync(releaseDir)
    mkdirSync(binDir)
    const version = '0.1.0'
    const channel = 'latest'
    const packages = packageNames.map((packageName, index) => {
      const filename = `package-${index + 1}.tgz`
      const sha1 = `${index + 1}`.repeat(40)
      writeFileSync(join(releaseDir, filename), `${packageName}@${version}`)
      return { name: packageName, version, filename, sha1 }
    })
    writeFileSync(
      join(releaseDir, 'release-artifact.json'),
      JSON.stringify({ version, channel, packages }),
    )

    const existing = new Set(options.existing ?? [])
    const attested = new Set(options.attested ?? [])
    const statePath = join(root, 'registry.json')
    writeFileSync(
      statePath,
      JSON.stringify({
        packages: Object.fromEntries(
          packages.map((pkg) => {
            if (!existing.has(pkg.name)) return [pkg.name, null]
            const versions = [pkg.version]
            if (options.extraVersion === pkg.name) versions.push('0.1.1')
            return [
              pkg.name,
              {
                versions,
                versionViews: 0,
                addLaterVersion:
                  options.laterVersionDuringVerification === pkg.name,
                tags: {
                  [channel]:
                    options.wrongTag === pkg.name ? '0.0.1' : pkg.version,
                },
                releases: {
                  [pkg.version]: {
                    sha1:
                      options.differentBytes === pkg.name
                        ? '0'.repeat(40)
                        : pkg.sha1,
                    attestations: attested.has(pkg.name)
                      ? { url: 'https://registry.example/provenance' }
                      : null,
                  },
                },
              },
            ]
          }),
        ),
        tarballs: Object.fromEntries(
          packages.map((pkg) => [
            basename(pkg.filename),
            { ...pkg, path: join(releaseDir, pkg.filename) },
          ]),
        ),
        publishProvenance: options.publishProvenance !== false,
        publishes: [],
      }),
    )
    const npmPath = join(binDir, 'npm')
    writeFileSync(npmPath, fakeNpmProgram())
    chmodSync(npmPath, 0o755)
    const runnerPath = join(root, 'publish.cjs')
    writeFileSync(runnerPath, publishScript)
    const outputPath = join(root, 'output.txt')
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        ALLOW_BOOTSTRAP: options.allowBootstrap ? 'true' : 'false',
        PATH: `${binDir}:${process.env.PATH}`,
        FAKE_NPM_STATE: statePath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
        RELEASE_VERSION: version,
        REGISTRY_POLL_ATTEMPTS: '5',
        REGISTRY_POLL_DELAY_MS: '0',
      },
    })
    const diagnostic = `${result.stdout}\n${result.stderr}`
    if (options.expectedError) {
      assert(result.status !== 0, `${name} unexpectedly succeeded.`)
      assert(
        diagnostic.includes(options.expectedError),
        `${name} failed for the wrong reason: ${diagnostic}`,
      )
      return
    }
    assert(result.status === 0, `${name} failed: ${diagnostic}`)
    assert(
      readFileSync(outputPath, 'utf8').includes(
        `bootstrap=${String(options.expectedBootstrap)}`,
      ),
      `${name} reported the wrong mode.`,
    )
    const output = readFileSync(outputPath, 'utf8')
    assert(
      output.includes(`modes=${JSON.stringify(options.expectedModes)}`),
      `${name} reported the wrong package modes: ${output}`,
    )
    const expectedBootstrapPackages = Object.entries(options.expectedModes)
      .filter(([, mode]) => mode === 'bootstrap')
      .map(([packageName]) => packageName)
      .join(',')
    assert(
      output.includes(`bootstrap-packages=${expectedBootstrapPackages}`),
      `${name} reported the wrong bootstrap packages: ${output}`,
    )
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert(
      state.publishes.length === options.expectedPublishes,
      `${name} published the wrong count.`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function fakeNpmProgram() {
  return `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const statePath = process.env.FAKE_NPM_STATE
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const args = process.argv.slice(2)
const save = () => fs.writeFileSync(statePath, JSON.stringify(state))
const output = value => process.stdout.write(JSON.stringify(value) + '\\n')
if (args[0] === '--version') {
  process.stdout.write('11.5.0\\n')
  process.exit(0)
}
if (args[0] === 'view') {
  const spec = args[1]
  const field = args[2]
  const match = /^(@[^/]+\\/[^@]+)@(.+)$/.exec(spec)
  const name = match ? match[1] : spec
  const version = match?.[2]
  const pkg = state.packages[name]
  const release = version ? pkg?.releases?.[version] : null
  let value
  if (field === 'dist.shasum') value = release?.sha1
  else if (field === 'dist.attestations') value = release?.attestations
  else if (field === 'versions') {
    if (pkg?.addLaterVersion && pkg.versionViews > 0 && !pkg.versions.includes('0.1.1')) {
      pkg.versions.push('0.1.1')
    }
    if (pkg) pkg.versionViews += 1
    save()
    value = pkg?.versions
  }
  else if (field.startsWith('dist-tags.')) value = pkg?.tags?.[field.slice('dist-tags.'.length)]
  if (value === undefined || value === null) {
    process.stderr.write('E404 404 Not Found\\n')
    process.exit(1)
  }
  output(value)
  process.exit(0)
}
if (args[0] === 'publish') {
  const tarball = state.tarballs[path.basename(args[1])]
  if (!tarball) throw new Error('Unknown tarball')
  const tag = args[args.indexOf('--tag') + 1]
  state.packages[tarball.name] = {
    versions: [tarball.version],
    tags: { [tag]: tarball.version },
    releases: {
      [tarball.version]: {
        sha1: tarball.sha1,
        attestations: state.publishProvenance
          ? { url: 'https://registry.example/provenance' }
          : null,
      },
    },
  }
  state.publishes.push(tarball.name)
  save()
  process.exit(0)
}
throw new Error('Unsupported fake npm command: ' + args.join(' '))
`
}
