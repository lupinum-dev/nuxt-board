import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { parse } from 'yaml'

const workflow = readFileSync(
  new URL('../.github/workflows/publish.yml', import.meta.url),
  'utf8',
)
const publishConfig = parse(workflow)
const sigstoreManifest = JSON.parse(
  readFileSync(
    new URL('./sigstore-verifier/package.json', import.meta.url),
    'utf8',
  ),
)
const sigstoreLock = JSON.parse(
  readFileSync(
    new URL('./sigstore-verifier/package-lock.json', import.meta.url),
    'utf8',
  ),
)
const packageManifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const packageNames = [
  '@lupinum/board-core',
  '@lupinum/vue-board',
  '@lupinum/board-history',
  '@lupinum/board-connections',
  '@lupinum/nuxt-board',
]
assert(
  /^pnpm@(?:1[1-9]|[2-9]\d)\./u.test(packageManifest.packageManager ?? ''),
  'pnpm 11 or newer is required for strict dependency quarantine.',
)
const ciWorkflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
const ciConfig = parse(ciWorkflow)
const classifyScript = ciConfig.jobs.classify.steps.find(
  (step) => step.name === 'Select required lanes',
)?.with?.script
assert(
  typeof classifyScript === 'string',
  'CI must classify expensive pull-request lanes.',
)
const ciGate = ciConfig.jobs.gate
assert(
  ciGate.if === 'always()' &&
    ciGate.name === 'CI gate' &&
    ciGate.needs.includes('checks') &&
    ciGate.needs.includes('visual-regression'),
  'CI must expose one always-reported gate for every classified lane.',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
for (const scenario of [
  {
    name: 'public docs',
    event: 'pull_request',
    paths: ['docs/content/1.index.md'],
    full: 'false',
  },
  {
    name: 'library source',
    event: 'pull_request',
    paths: ['packages/core/src/index.ts'],
    full: 'true',
  },
  {
    name: 'workflow policy',
    event: 'pull_request',
    paths: ['.github/workflows/ci.yml'],
    full: 'true',
  },
  { name: 'main certification', event: 'push', paths: [], full: 'true' },
]) {
  const outputs = new Map()
  await new AsyncFunction('context', 'github', 'core', classifyScript)(
    {
      eventName: scenario.event,
      issue: { number: 1 },
      repo: { owner: 'lupinum-dev', repo: 'nuxt-board' },
    },
    {
      paginate: async () => scenario.paths.map((filename) => ({ filename })),
      rest: { pulls: { listFiles() {} } },
    },
    { setOutput: (name, value) => outputs.set(name, value) },
  )
  assert(
    outputs.get('full') === scenario.full,
    `CI classification failed the ${scenario.name} fixture.`,
  )
}
const versionWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
)
const versionConfig = parse(versionWorkflow)
const versionPatchStep = versionConfig.jobs['prepare-version'].steps.find(
  (step) => step.name === 'Generate version files without write credentials',
)
assert(
  versionPatchStep,
  'The release workflow must prepare an inert version patch.',
)
assert(
  versionPatchStep.run.includes('git diff HEAD --binary --full-index') &&
    versionPatchStep.run.includes('git diff HEAD --quiet'),
  'The version patch must include staged Changeset deletions and new files.',
)
assert(
  versionConfig.on?.workflow_run?.workflows?.includes('ci') &&
    versionConfig.jobs['prepare-version'].if.includes(
      "workflow_run.conclusion == 'success'",
    ) &&
    versionWorkflow.includes('github.event.workflow_run.head_sha') &&
    versionWorkflow.includes(
      'The default branch advanced after the version patch was prepared.',
    ),
  'The version workflow must use a successful, still-current main CI SHA.',
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
const verifyJob = /^  verify:\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n)/m.exec(
  workflow,
)?.[1]
assert(verifyJob, 'publish.yml is missing the unprivileged verification job.')
for (const required of [
  'cp scripts/sigstore-verifier/package.json',
  'scripts/sigstore-verifier/package-lock.json',
  'npm ci --prefix "$SIGSTORE_PREFIX" --ignore-scripts --no-audit --no-fund',
  'node scripts/verify-registry-provenance.mjs',
  '.release/registry-verification.json',
  "fs.readdirSync('.', { withFileTypes: true })",
  'Release directory contains an unlisted or missing tarball',
  'while [ "$tag_type" = tag ]',
  'test "$tag_type" = commit',
]) {
  assert(
    verifyJob.includes(required),
    `The verification job is missing: ${required}`,
  )
}
assert(
  !verifyJob.includes('npm install') &&
    !verifyJob.includes('npm view sigstore'),
  'The verification job must install only the committed lock with npm ci.',
)
assert(
  sigstoreManifest.private === true &&
    sigstoreManifest.engines.node === '^24.15.0' &&
    sigstoreManifest.dependencies.sigstore === '5.0.0' &&
    !sigstoreManifest.devDependencies,
  'The isolated verifier must not change the public workspace Node contract.',
)
assert(
  sigstoreLock.lockfileVersion === 3 &&
    sigstoreLock.packages[''].dependencies.sigstore === '5.0.0' &&
    sigstoreLock.packages['node_modules/sigstore'].version === '5.0.0',
  'The isolated verifier lock must match its exact manifest dependency.',
)
const unlockedVerifierPackages = Object.entries(sigstoreLock.packages)
  .filter(([path]) => path)
  .filter(
    ([, pkg]) =>
      !pkg.version ||
      !pkg.resolved?.startsWith('https://registry.npmjs.org/') ||
      !pkg.integrity?.startsWith('sha512-'),
  )
assert(
  Object.keys(sigstoreLock.packages).length > 2 &&
    unlockedVerifierPackages.length === 0,
  `Every isolated verifier package must be locked: ${unlockedVerifierPackages
    .map(([path]) => path)
    .join(', ')}`,
)
assert(
  publishJob.includes('environment: npm'),
  'The publish job must use the npm environment.',
)
assert(
  publishJob.includes('id-token: write'),
  'The publish job must use trusted publishing.',
)
assert(
  !publishJob.includes('git/ref/heads/main'),
  'The protected job must keep the dispatch-time certified SHA valid while approval waits.',
)
for (const forbidden of [
  'actions/checkout@',
  'npm install',
  'pnpm install',
  'node scripts/',
  'npm ci',
  "from 'sigstore'",
  "require('sigstore')",
  'createVerifier',
]) {
  assert(
    !publishJob.includes(forbidden),
    `The publish job must not contain ${forbidden}.`,
  )
}

const releaseJob = /^  github-release:\n([\s\S]*)$/m.exec(workflow)?.[1]
assert(releaseJob, 'publish.yml is missing GitHub release creation.')
assert(
  Object.keys(publishConfig.on?.workflow_dispatch?.inputs ?? {}).join(',') ===
    'version',
  'Publish dispatch must accept only the reviewed fixed-set version.',
)
assert(
  publishConfig.jobs.publish.if ===
    "needs.verify.outputs.publish-required == 'true'",
  'The protected npm environment must be skipped when every package already matches.',
)
assert(
  publishConfig.jobs['github-release'].if.includes(
    "needs.publish.result == 'skipped'",
  ),
  'Release repair must remain available after a verified npm no-op.',
)
for (const required of [
  '/releases/tags/$RELEASE_TAG',
  'gh api --silent --method POST',
  'while [ "$tag_type" = tag ]',
  'test "$tag_type" = commit',
  'test "$tag_sha" = "$SOURCE_SHA"',
  '--prerelease="$prerelease"',
  '.release/registry-verification.json',
  '"${release_assets[@]}"',
  '--clobber',
  'HUMAN-ONLY:',
  'HTTP 403',
]) {
  assert(
    releaseJob.includes(required),
    `GitHub release recovery is missing: ${required}`,
  )
}
for (const forbidden of [
  '--method DELETE',
  '--method PATCH',
  'git update-ref',
]) {
  assert(
    !releaseJob.includes(forbidden),
    `GitHub release recovery must not contain ${forbidden}.`,
  )
}
assert(
  workflow.includes('name: verified-nuxt-board-release') &&
    workflow.includes('retention-days: 14'),
  'The verified release artifact must be retained for 14 days.',
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
for (const required of [
  'registry-verification.json',
  'verification.releaseArtifactSha256',
  'was absent during verification but now exists; rerun verification',
  "hash(tarball, 'sha512') !== verified.sha512",
  'hasAttestations(attestations)',
  "url.origin !== 'https://registry.npmjs.org'",
  "redirect: 'error'",
  'candidates.length !== 1',
  'provenance bundle changed after verification',
]) {
  assert(
    publishJob.includes(required),
    `The protected publish job is missing: ${required}`,
  )
}
assert(
  !releaseJob.includes('.release/*.tgz'),
  'GitHub Releases must upload only manifest-listed package tarballs.',
)

const verifyArtifactStep = publishConfig.jobs.verify.steps.find(
  (step) => step.name === 'Verify the exact fixed-version package set',
)
const verifyArtifactLines = verifyArtifactStep?.run?.split('\n') ?? []
const verifyArtifactStart = verifyArtifactLines.findIndex((line) =>
  line.includes("node - <<'NODE'"),
)
const verifyArtifactEnd = verifyArtifactLines.findIndex(
  (line, index) => index > verifyArtifactStart && line.trim() === 'NODE',
)
assert(
  verifyArtifactStart >= 0 && verifyArtifactEnd > verifyArtifactStart,
  'The artifact verification step must contain one inline Node program.',
)
const verifyArtifactScript = dedent(
  verifyArtifactLines
    .slice(verifyArtifactStart + 1, verifyArtifactEnd)
    .join('\n'),
)
runVerifyArtifactScenario('the exact five tarballs pass verification', {
  expectedSuccess: true,
})
runVerifyArtifactScenario('an unlisted tarball fails verification', {
  extraTarball: true,
  expectedSuccess: false,
})

const githubReleaseScript = publishConfig.jobs['github-release'].steps.find(
  (step) => step.name === 'Create the release from the published artifacts',
)?.run
assert(
  githubReleaseScript,
  'The GitHub release fixture is missing its shell program.',
)
runGitHubReleaseScenario('absent tag is created at the certified source', {
  expectedActions: ['create-tag', 'create-release'],
  expectedSuccess: true,
})
runGitHubReleaseScenario('an existing tag without a Release is recoverable', {
  tag: { type: 'commit', sha: 'a'.repeat(40) },
  expectedActions: ['create-release'],
  expectedSuccess: true,
})
runGitHubReleaseScenario('existing stable Release is repaired as stable', {
  releaseExists: true,
  tag: { type: 'commit', sha: 'a'.repeat(40) },
  expectedActions: ['upload-release', 'edit-release'],
  expectedSuccess: true,
})
runGitHubReleaseScenario('existing prerelease is repaired as prerelease', {
  version: '0.1.0-beta.1',
  releaseExists: true,
  tag: { type: 'commit', sha: 'a'.repeat(40) },
  expectedActions: ['upload-release', 'edit-release'],
  expectedSuccess: true,
})
runGitHubReleaseScenario('nested annotated tags are peeled', {
  tag: { type: 'tag', sha: '1'.repeat(40) },
  tagObjects: {
    ['1'.repeat(40)]: { type: 'tag', sha: '2'.repeat(40) },
    ['2'.repeat(40)]: { type: 'commit', sha: 'a'.repeat(40) },
  },
  expectedActions: ['create-release'],
  expectedSuccess: true,
})
runGitHubReleaseScenario('wrong tag appearance fails closed', {
  tag: { type: 'commit', sha: 'b'.repeat(40) },
  expectedActions: [],
  expectedSuccess: false,
})
runGitHubReleaseScenario('Release without a tag fails closed', {
  releaseExists: true,
  expectedActions: [],
  expectedSuccess: false,
})
runGitHubReleaseScenario('historical tag 403 gives a maintainer command', {
  postForbidden: true,
  expectedActions: [],
  expectedSuccess: false,
  expectedDiagnostic: 'HUMAN-ONLY:',
})

const publishLines = publishJob.split('\n')
const publishStart = publishLines.findIndex((line) =>
  line.includes("node --input-type=module <<'NODE'"),
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

const allOidc = Object.fromEntries(packageNames.map((name) => [name, 'oidc']))
runScenario('missing packages use OIDC', {
  expectedPublishes: 5,
})
runScenario('mixed package sets recover safely', {
  verificationModes: Object.fromEntries(
    packageNames.map((name, index) => [name, index < 2 ? 'oidc' : 'absent']),
  ),
  expectedPublishes: 3,
})
runScenario('different bytes fail', {
  verificationModes: allOidc,
  differentBytes: packageNames[0],
  expectedError: 'changed after verification',
})
runScenario('wrong dist-tags fail', {
  verificationModes: allOidc,
  wrongTag: packageNames[4],
  expectedError: 'tag changed after verification',
})
runScenario('an off-origin provenance URL fails', {
  verificationModes: allOidc,
  changedAttestationOrigin: packageNames[0],
  expectedError: 'returned an untrusted npm attestation URL',
  expectNoPublishes: true,
})
runScenario('a non-attestation registry URL fails', {
  verificationModes: allOidc,
  changedAttestationPath: packageNames[1],
  expectedError: 'returned an untrusted npm attestation URL',
  expectNoPublishes: true,
})
runScenario('a changed provenance bundle fails', {
  verificationModes: allOidc,
  changedAttestationBundle: packageNames[2],
  expectedError: 'provenance bundle changed after verification',
  expectNoPublishes: true,
})
runScenario('multiple SLSA provenance bundles fail', {
  verificationModes: allOidc,
  multipleAttestationBundles: packageNames[3],
  expectedError: 'must expose exactly one SLSA provenance bundle',
  expectNoPublishes: true,
})
runScenario('provenance-free registry records fail', {
  verificationModes: Object.fromEntries(
    packageNames.map((name, index) => [
      name,
      index === 0 ? 'bootstrap' : 'oidc',
    ]),
  ),
  expectedError: 'invalid registry verification mode',
})
runScenario('absent package appearing after verification fails closed', {
  appearedAfterVerification: packageNames[0],
  expectedError:
    'was absent during verification but now exists; rerun verification',
  expectNoPublishes: true,
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

function digest(content, algorithm) {
  return createHash(algorithm).update(content).digest('hex')
}

function runVerifyArtifactScenario(name, options) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-board-artifact-policy-'))
  try {
    const releaseDir = join(root, '.release')
    mkdirSync(releaseDir)
    const sourceSha = 'a'.repeat(40)
    const version = '0.1.0'
    const changelog = `## v${version}\n\nRelease notes.\n`
    writeFileSync(join(releaseDir, 'CHANGELOG.md'), changelog)
    const packages = packageNames.map((packageName, index) => {
      const filename = `package-${index + 1}.tgz`
      const content = Buffer.from(`${packageName}@${version}`)
      writeFileSync(join(releaseDir, filename), content)
      return {
        name: packageName,
        version,
        filename,
        sha1: digest(content, 'sha1'),
        sha256: digest(content, 'sha256'),
      }
    })
    writeFileSync(
      join(releaseDir, 'release-artifact.json'),
      JSON.stringify({
        commit: sourceSha,
        version,
        channel: 'latest',
        changelog: {
          filename: 'CHANGELOG.md',
          sha256: digest(changelog, 'sha256'),
        },
        packages,
      }),
    )
    if (options.extraTarball) {
      writeFileSync(join(releaseDir, 'unlisted.tgz'), 'unlisted')
    }
    const runnerPath = join(root, 'verify.cjs')
    writeFileSync(runnerPath, verifyArtifactScript)
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: releaseDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_SHA: sourceSha,
        RELEASE_VERSION: version,
      },
    })
    const diagnostic = `${result.stdout}\n${result.stderr}`
    assert(
      (result.status === 0) === options.expectedSuccess,
      `${name} returned the wrong status: ${diagnostic}`,
    )
    if (!options.expectedSuccess) {
      assert(
        diagnostic.includes('unlisted or missing tarball'),
        `${name} failed for the wrong reason: ${diagnostic}`,
      )
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function runScenario(name, options) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-board-release-policy-'))
  try {
    const releaseDir = join(root, '.release')
    const binDir = join(root, 'bin')
    mkdirSync(releaseDir)
    mkdirSync(binDir)
    const sourceSha = 'a'.repeat(40)
    const version = '0.1.0'
    const channel = 'latest'
    const packages = packageNames.map((packageName, index) => {
      const filename = `package-${index + 1}.tgz`
      const content = Buffer.from(`${packageName}@${version}`)
      writeFileSync(join(releaseDir, filename), content)
      return {
        name: packageName,
        version,
        filename,
        sha1: digest(content, 'sha1'),
        sha256: digest(content, 'sha256'),
        sha512: digest(content, 'sha512'),
      }
    })
    const provenanceBundles = Object.fromEntries(
      packages.map((pkg) => [
        pkg.name,
        {
          fixture: pkg.name,
          sourceSha,
          tarballSha512: pkg.sha512,
        },
      ]),
    )
    const attestationUrls = Object.fromEntries(
      packages.map((pkg, index) => {
        let url = `https://registry.npmjs.org/-/npm/v1/attestations/fixture-${index}`
        if (options.changedAttestationOrigin === pkg.name) {
          url = `https://attacker.example/-/npm/v1/attestations/fixture-${index}`
        }
        if (options.changedAttestationPath === pkg.name) {
          url = `https://registry.npmjs.org/-/npm/v1/not-attestations/fixture-${index}`
        }
        return [pkg.name, url]
      }),
    )
    const attestationDocuments = Object.fromEntries(
      packages.map((pkg) => {
        const bundle =
          options.changedAttestationBundle === pkg.name
            ? { ...provenanceBundles[pkg.name], changed: true }
            : provenanceBundles[pkg.name]
        const attestations = [
          {
            predicateType: 'https://slsa.dev/provenance/v1',
            bundle,
          },
        ]
        if (options.multipleAttestationBundles === pkg.name) {
          attestations.push({
            predicateType: 'https://slsa.dev/provenance/v1',
            bundle: { ...bundle, duplicate: true },
          })
        }
        return [attestationUrls[pkg.name], { attestations }]
      }),
    )
    const manifestText = `${JSON.stringify(
      {
        commit: sourceSha,
        version,
        channel,
        packages: [...packages]
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(({ sha512: _, ...pkg }) => pkg),
      },
      null,
      2,
    )}\n`
    writeFileSync(join(releaseDir, 'release-artifact.json'), manifestText)

    const verificationModes =
      options.verificationModes ??
      Object.fromEntries(
        packageNames.map((packageName) => [packageName, 'absent']),
      )
    writeFileSync(
      join(releaseDir, 'registry-verification.json'),
      JSON.stringify({
        schemaVersion: 1,
        releaseArtifactSha256: digest(manifestText, 'sha256'),
        sourceSha,
        version,
        channel,
        sigstoreVersion: '5.0.0',
        workflow: {
          repository: 'https://github.com/lupinum-dev/nuxt-board',
          path: '.github/workflows/publish.yml',
          ref: 'refs/heads/main',
          identity:
            'https://github.com/lupinum-dev/nuxt-board/.github/workflows/publish.yml@refs/heads/main',
          certificateIssuer: 'https://token.actions.githubusercontent.com',
          certificateOIDs: {
            '1.3.6.1.4.1.57264.1.3': sourceSha,
            '1.3.6.1.4.1.57264.1.5': 'lupinum-dev/nuxt-board',
            '1.3.6.1.4.1.57264.1.6': 'refs/heads/main',
          },
        },
        packages: packages.map((pkg) => {
          const mode = verificationModes[pkg.name]
          return {
            ...pkg,
            mode,
            registryShasum: mode === 'absent' ? null : pkg.sha1,
            channelVersion: mode === 'absent' ? null : pkg.version,
            provenanceBundleSha256:
              mode === 'oidc'
                ? digest(JSON.stringify(provenanceBundles[pkg.name]), 'sha256')
                : null,
          }
        }),
      }),
    )

    const statePath = join(root, 'registry.json')
    writeFileSync(
      statePath,
      JSON.stringify({
        packages: Object.fromEntries(
          packages.map((pkg) => {
            const mode = verificationModes[pkg.name]
            const appeared = options.appearedAfterVerification === pkg.name
            if (mode === 'absent' && !appeared) return [pkg.name, null]
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
                    attestations:
                      mode === 'oidc' || appeared
                        ? { url: attestationUrls[pkg.name] }
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
        attestationDocuments,
      }),
    )
    const npmPath = join(binDir, 'npm')
    writeFileSync(npmPath, fakeNpmProgram())
    chmodSync(npmPath, 0o755)
    const publishPath = join(root, 'publish-under-test.mjs')
    writeFileSync(publishPath, publishScript)
    const runnerPath = join(root, 'publish.mjs')
    writeFileSync(
      runnerPath,
      `import { readFileSync } from 'node:fs'
globalThis.fetch = async (input, options) => {
  if (options?.redirect !== 'error' || options?.headers?.Accept !== 'application/json') {
    throw new Error('Unsafe attestation fetch options')
  }
  const state = JSON.parse(readFileSync(process.env.FAKE_NPM_STATE, 'utf8'))
  const document = state.attestationDocuments[String(input)]
  return {
    ok: Boolean(document),
    status: document ? 200 : 404,
    json: async () => document,
  }
}
await import('./publish-under-test.mjs')
`,
    )
    const outputPath = join(root, 'output.txt')
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        FAKE_NPM_STATE: statePath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
        RELEASE_VERSION: version,
        SOURCE_SHA: sourceSha,
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
      if (options.expectNoPublishes) {
        const state = JSON.parse(readFileSync(statePath, 'utf8'))
        assert(
          state.publishes.length === 0,
          `${name} published before validation failed.`,
        )
      }
      return
    }
    assert(result.status === 0, `${name} failed: ${diagnostic}`)
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert(
      state.publishes.length === options.expectedPublishes,
      `${name} published the wrong count.`,
    )
    const expectedPublishOrder = packageNames.filter(
      (packageName) => verificationModes[packageName] === 'absent',
    )
    assert(
      JSON.stringify(state.publishes) === JSON.stringify(expectedPublishOrder),
      `${name} did not preserve dependency publication order.`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function runGitHubReleaseScenario(name, options) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-board-github-release-policy-'))
  try {
    const releaseDir = join(root, '.release')
    const binDir = join(root, 'bin')
    mkdirSync(releaseDir)
    mkdirSync(binDir)
    const version = options.version ?? '0.1.0'
    const releaseTag = `v${version}`
    writeFileSync(
      join(releaseDir, 'CHANGELOG.md'),
      `## ${releaseTag}\n\nRelease notes.\n`,
    )
    const packageAssets = packageNames.map((name, index) => {
      const filename = `package-${index + 1}.tgz`
      writeFileSync(join(releaseDir, filename), `${name}@${version}`)
      return { name, filename }
    })
    for (const [filename, content] of [
      ['SHA256SUMS', 'fixture'],
      ['registry-verification.json', '{}'],
      ['unlisted.tgz', 'must not be uploaded'],
    ]) {
      writeFileSync(join(releaseDir, filename), content)
    }
    writeFileSync(
      join(releaseDir, 'release-artifact.json'),
      JSON.stringify({ packages: packageAssets }),
    )
    const expectedAssets = [
      ...packageAssets.map((pkg) => `.release/${pkg.filename}`),
      '.release/CHANGELOG.md',
      '.release/SHA256SUMS',
      '.release/release-artifact.json',
      '.release/registry-verification.json',
    ]
    const statePath = join(root, 'github.json')
    writeFileSync(
      statePath,
      JSON.stringify({
        actions: [],
        expectedAssets,
        expectedPrerelease: version.includes('-'),
        releaseExists: options.releaseExists ?? false,
        releaseTag,
        sourceSha: 'a'.repeat(40),
        postForbidden: options.postForbidden ?? false,
        tag: options.tag ?? null,
        tagObjects: options.tagObjects ?? {},
      }),
    )
    for (const [command, program] of [
      ['curl', fakeCurlProgram()],
      ['gh', fakeGhProgram()],
    ]) {
      const path = join(binDir, command)
      writeFileSync(path, program)
      chmodSync(path, 0o755)
    }
    const runnerPath = join(root, 'github-release.sh')
    writeFileSync(runnerPath, githubReleaseScript)
    const result = spawnSync(
      '/bin/bash',
      ['-e', '-o', 'pipefail', runnerPath],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          FAKE_GITHUB_STATE: statePath,
          GH_TOKEN: 'fixture-token',
          GITHUB_API_URL: 'https://api.github.test',
          GITHUB_REPOSITORY: 'lupinum-dev/nuxt-board',
          PATH: `${binDir}:${process.env.PATH}`,
          RELEASE_VERSION: version,
          SOURCE_SHA: 'a'.repeat(40),
        },
      },
    )
    const diagnostic = `${result.stdout}\n${result.stderr}`
    assert(
      (result.status === 0) === options.expectedSuccess,
      `${name} returned the wrong status: ${diagnostic}`,
    )
    if (options.expectedDiagnostic) {
      assert(
        diagnostic.includes(options.expectedDiagnostic),
        `${name} missed its diagnostic: ${diagnostic}`,
      )
    }
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert(
      JSON.stringify(state.actions) === JSON.stringify(options.expectedActions),
      `${name} performed the wrong GitHub mutations: ${JSON.stringify(state.actions)}`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function fakeCurlProgram() {
  return `#!/usr/bin/env node
const fs = require('node:fs')
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GITHUB_STATE, 'utf8'))
const url = process.argv.at(-1)
if (url.includes('/releases/tags/')) process.stdout.write(state.releaseExists ? '200' : '404')
else process.stdout.write(state.tag ? '200' : '404')
`
}

function fakeGhProgram() {
  return `#!/usr/bin/env node
const fs = require('node:fs')
const statePath = process.env.FAKE_GITHUB_STATE
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const args = process.argv.slice(2)
const save = () => fs.writeFileSync(statePath, JSON.stringify(state))
const fail = message => { process.stderr.write(message + '\\n'); process.exit(1) }
const output = value => process.stdout.write(String(value) + '\\n')
const requireExactAssets = () => {
  const optionsStart = args.indexOf('--repo')
  const assets = args.slice(3, optionsStart)
  if (JSON.stringify(assets) !== JSON.stringify(state.expectedAssets)) {
    fail('release assets differ: ' + JSON.stringify(assets))
  }
}

if (args[0] === 'release') {
  const operation = args[1]
  if (operation === 'upload') {
    if (!state.releaseExists) fail('release does not exist')
    requireExactAssets()
    state.actions.push('upload-release')
    save()
    process.exit(0)
  }
  if (operation === 'edit') {
    if (!state.releaseExists) fail('release does not exist')
    if (!args.includes('--prerelease=' + String(state.expectedPrerelease))) {
      fail('release prerelease state was not reconciled')
    }
    state.actions.push('edit-release')
    save()
    process.exit(0)
  }
  if (operation === 'create') {
    if (state.releaseExists) fail('release already exists')
    if (!state.tag || !args.includes('--verify-tag')) fail('verified tag is required')
    requireExactAssets()
    if (args.includes('--prerelease') !== state.expectedPrerelease) {
      fail('created release has the wrong prerelease state')
    }
    state.releaseExists = true
    state.actions.push('create-release')
    save()
    process.exit(0)
  }
}

if (args[0] === 'api') {
  const endpoint = args.find(value => value.startsWith('repos/'))
  const methodIndex = args.indexOf('--method')
  const method = methodIndex === -1 ? 'GET' : args[methodIndex + 1]
  if (method === 'POST' && endpoint.endsWith('/git/refs')) {
    if (state.postForbidden) fail('Resource not accessible by integration (HTTP 403)')
    if (state.tag) fail('tag already exists')
    const ref = args.find(value => value.startsWith('ref='))?.slice(4)
    const sha = args.find(value => value.startsWith('sha='))?.slice(4)
    if (ref !== 'refs/tags/' + state.releaseTag || sha !== state.sourceSha) {
      fail('wrong tag creation')
    }
    state.tag = { type: 'commit', sha }
    state.actions.push('create-tag')
    save()
    process.exit(0)
  }
  const jq = args[args.indexOf('--jq') + 1]
  let object
  if (endpoint.includes('/git/ref/tags/')) object = state.tag
  else if (endpoint.includes('/git/tags/')) {
    object = state.tagObjects[endpoint.split('/').at(-1)]
  }
  if (!object) fail('git object does not exist')
  if (jq === '.object.type') output(object.type)
  else if (jq === '.object.sha') output(object.sha)
  else fail('unsupported jq expression')
  process.exit(0)
}

fail('unsupported gh command: ' + args.join(' '))
`
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
  if (field === 'version') value = release ? version : null
  else if (field === 'dist.shasum') value = release?.sha1
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
