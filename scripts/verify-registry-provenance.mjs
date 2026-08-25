import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const PREDICATE_TYPE = 'https://slsa.dev/provenance/v1'
export const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1'
export const PUBLISH_ORDER = Object.freeze([
  '@lupinum/board-core',
  '@lupinum/vue-board',
  '@lupinum/board-history',
  '@lupinum/board-connections',
  '@lupinum/nuxt-board',
])
export const WORKFLOW = Object.freeze({
  repository: 'https://github.com/lupinum-dev/nuxt-board',
  repositorySlug: 'lupinum-dev/nuxt-board',
  path: '.github/workflows/publish.yml',
  ref: 'refs/heads/main',
  identity:
    'https://github.com/lupinum-dev/nuxt-board/.github/workflows/publish.yml@refs/heads/main',
  sourceDependency:
    'git+https://github.com/lupinum-dev/nuxt-board@refs/heads/main',
})
export const CERTIFICATE_OIDS = Object.freeze({
  sourceSha: '1.3.6.1.4.1.57264.1.3',
  repository: '1.3.6.1.4.1.57264.1.5',
  ref: '1.3.6.1.4.1.57264.1.6',
})

const REGISTRY_URL = 'https://registry.npmjs.org'
const ATTESTATION_PATH_PREFIX = '/-/npm/v1/attestations/'
const ATTESTATION_TIMEOUT_MS = 10_000
const SIGSTORE_BASE_OPTIONS = Object.freeze({
  certificateIssuer: 'https://token.actions.githubusercontent.com',
  certificateIdentityURI:
    '^https://github\\.com/lupinum-dev/nuxt-board/\\.github/workflows/publish\\.yml@refs/heads/main$',
  ctLogThreshold: 1,
  tlogThreshold: 1,
})

export function createSigstoreOptions(sourceSha) {
  assert(
    /^[0-9a-f]{40}$/u.test(sourceSha),
    'Sigstore certificate source SHA is invalid.',
  )
  return Object.freeze({
    ...SIGSTORE_BASE_OPTIONS,
    certificateOIDs: Object.freeze({
      [CERTIFICATE_OIDS.sourceSha]: sourceSha,
      [CERTIFICATE_OIDS.repository]: WORKFLOW.repositorySlug,
      [CERTIFICATE_OIDS.ref]: WORKFLOW.ref,
    }),
  })
}

export function hasAttestations(value) {
  return Array.isArray(value)
    ? value.length > 0
    : Boolean(value && typeof value === 'object' && Object.keys(value).length)
}

export function validateNpmAttestationUrl(urlString) {
  assert(typeof urlString === 'string', 'npm attestation URL is invalid.')
  let url
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('npm attestation URL is invalid.')
  }
  assert(
    url.origin === REGISTRY_URL &&
      url.pathname.startsWith(ATTESTATION_PATH_PREFIX) &&
      url.pathname.length > ATTESTATION_PATH_PREFIX.length &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    'Untrusted npm attestation URL.',
  )
  return url
}

export async function fetchNpmAttestations(
  urlString,
  fetchImplementation = fetch,
) {
  const url = validateNpmAttestationUrl(urlString)
  const response = await fetchImplementation(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(ATTESTATION_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(
      `npm attestation lookup failed with HTTP ${response.status}.`,
    )
  }
  return response.json()
}

export async function createRegistryVerification({
  artifact,
  artifactBytes,
  fetchAttestations,
  releaseDir,
  verifyBundle,
  view,
}) {
  assert(
    /^[0-9a-f]{40}$/u.test(artifact.commit),
    'Artifact source SHA is invalid.',
  )
  assert(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(artifact.version),
    'Artifact version is invalid.',
  )
  assert(
    artifact.channel === (artifact.version.includes('-') ? 'next' : 'latest'),
    'Artifact channel is invalid.',
  )
  assert(
    Array.isArray(artifact.packages) &&
      artifact.packages.length === PUBLISH_ORDER.length,
    'Artifact package set differs.',
  )
  const sigstoreOptions = createSigstoreOptions(artifact.commit)
  const packages = []

  for (const name of PUBLISH_ORDER) {
    const matches = artifact.packages.filter(
      (candidate) => candidate.name === name,
    )
    assert(
      matches.length === 1,
      `Artifact must contain exactly one ${name} package.`,
    )
    const pkg = matches[0]
    assert(
      pkg.version === artifact.version,
      `${name} version differs from the fixed set.`,
    )
    assert(
      pkg.filename === basename(pkg.filename) &&
        /^[A-Za-z0-9._-]+\.tgz$/u.test(pkg.filename),
      `${name} tarball path is invalid.`,
    )

    const bytes = readFileSync(join(releaseDir, pkg.filename))
    assert(
      digest(bytes, 'sha1') === pkg.sha1,
      `${name} failed SHA-1 verification.`,
    )
    assert(
      digest(bytes, 'sha256') === pkg.sha256,
      `${name} failed SHA-256 verification.`,
    )
    const sha512 = digest(bytes, 'sha512')
    const spec = `${name}@${pkg.version}`
    const registryVersion = view(spec, 'version', { allowMissing: true })
    const channelVersion = view(name, `dist-tags.${artifact.channel}`, {
      allowMissing: true,
    })

    if (registryVersion === null) {
      packages.push({
        ...pkg,
        sha512,
        mode: 'absent',
        registryShasum: null,
        channelVersion,
        provenanceBundleSha256: null,
      })
      continue
    }

    assert(
      registryVersion === pkg.version,
      `${spec} returned a different version.`,
    )
    const shasum = view(spec, 'dist.shasum')
    assert(shasum === pkg.sha1, `${spec} exists with different bytes.`)
    assert(
      channelVersion === pkg.version,
      `${spec} does not own the ${artifact.channel} npm tag.`,
    )
    const attestations = view(spec, 'dist.attestations', { allowMissing: true })
    if (hasAttestations(attestations)) {
      const provenanceBundleSha256 = await verifyNpmProvenance({
        attestations,
        expectedSha512: sha512,
        fetchAttestations,
        pkg,
        sigstoreOptions,
        sourceSha: artifact.commit,
        verifyBundle,
      })
      packages.push({
        ...pkg,
        sha512,
        mode: 'oidc',
        registryShasum: shasum,
        channelVersion,
        provenanceBundleSha256,
      })
      continue
    }

    assert(false, `${spec} exists without verifiable npm provenance.`)
  }

  return {
    schemaVersion: 1,
    releaseArtifactSha256: digest(artifactBytes, 'sha256'),
    sourceSha: artifact.commit,
    version: artifact.version,
    channel: artifact.channel,
    sigstoreVersion: '5.0.0',
    workflow: {
      repository: WORKFLOW.repository,
      path: WORKFLOW.path,
      ref: WORKFLOW.ref,
      identity: WORKFLOW.identity,
      certificateIssuer: sigstoreOptions.certificateIssuer,
      certificateOIDs: sigstoreOptions.certificateOIDs,
    },
    packages,
  }
}

async function verifyNpmProvenance({
  attestations,
  expectedSha512,
  fetchAttestations,
  pkg,
  sigstoreOptions,
  sourceSha,
  verifyBundle,
}) {
  assert(
    typeof attestations.url === 'string',
    `${pkg.name}@${pkg.version} has no attestation URL.`,
  )
  validateNpmAttestationUrl(attestations.url)
  const document = await fetchAttestations(attestations.url)
  const candidates = document?.attestations?.filter(
    (attestation) =>
      attestation.predicateType === PREDICATE_TYPE && attestation.bundle,
  )
  assert(
    Array.isArray(candidates) && candidates.length > 0,
    `${pkg.name}@${pkg.version} has no SLSA provenance bundle.`,
  )

  let lastError
  for (const candidate of candidates) {
    try {
      await verifyBundle(candidate.bundle, sigstoreOptions)
      const payload = candidate.bundle?.dsseEnvelope?.payload
      assert(
        typeof payload === 'string',
        'The verified provenance bundle has no DSSE payload.',
      )
      assert(
        candidate.bundle.dsseEnvelope.payloadType ===
          'application/vnd.in-toto+json',
        'The verified provenance bundle has the wrong DSSE payload type.',
      )
      const statement = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf8'),
      )
      verifyStatement({ expectedSha512, pkg, sourceSha, statement })
      return digest(JSON.stringify(candidate.bundle), 'sha256')
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    `${pkg.name}@${pkg.version} provenance verification failed: ${lastError?.message ?? 'unknown error'}`,
    { cause: lastError },
  )
}

function verifyStatement({ expectedSha512, pkg, sourceSha, statement }) {
  const expectedSubject = `pkg:npm/${pkg.name.replaceAll('@', '%40')}@${pkg.version}`
  const workflow =
    statement.predicate?.buildDefinition?.externalParameters?.workflow
  const dependencies =
    statement.predicate?.buildDefinition?.resolvedDependencies ?? []
  assert(
    statement._type === STATEMENT_TYPE,
    'Provenance statement type differs.',
  )
  assert(
    statement.predicateType === PREDICATE_TYPE,
    'Provenance predicate type differs.',
  )
  assert(
    statement.subject?.length === 1 &&
      statement.subject[0].name === expectedSubject &&
      statement.subject[0].digest?.sha512 === expectedSha512 &&
      Object.keys(statement.subject[0].digest ?? {}).length === 1,
    'Provenance subject does not match the exact npm tarball SHA-512.',
  )
  assert(
    workflow?.repository === WORKFLOW.repository &&
      workflow?.path === WORKFLOW.path &&
      workflow?.ref === WORKFLOW.ref,
    'Provenance workflow does not match publish.yml on main.',
  )
  assert(
    dependencies.length === 1 &&
      dependencies[0]?.uri === WORKFLOW.sourceDependency &&
      dependencies[0]?.digest?.gitCommit === sourceSha &&
      Object.keys(dependencies[0]?.digest ?? {}).length === 1,
    'Provenance source dependency does not match the certified source SHA.',
  )
  assert(
    statement.predicate?.runDetails?.builder?.id ===
      'https://github.com/actions/runner/github-hosted',
    'Provenance builder differs from GitHub-hosted Actions.',
  )
}

function npmView(spec, field, { allowMissing = false } = {}) {
  const result = spawnSync(
    'npm',
    ['view', spec, field, '--json', '--registry', REGISTRY_URL],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (result.status === 0) return JSON.parse(result.stdout.trim() || 'null')
  if (allowMissing && /E404|404 Not Found/u.test(result.stderr)) return null
  throw new Error(
    `npm view failed for ${spec} ${field}: ${result.stderr.trim()}`,
  )
}

async function main() {
  const args = process.argv.slice(2)
  const releaseDir =
    args[0] && !args[0].startsWith('--')
      ? resolve(args.shift())
      : resolve('.release')
  const summaryIndex = args.indexOf('--summary')
  const summaryPath = summaryIndex === -1 ? undefined : args[summaryIndex + 1]
  if (!process.env.SIGSTORE_PREFIX) {
    throw new Error(
      'SIGSTORE_PREFIX must point to the isolated Sigstore installation.',
    )
  }

  const requireSigstore = createRequire(
    join(resolve(process.env.SIGSTORE_PREFIX), 'package.json'),
  )
  const { createVerifier } = requireSigstore('sigstore')
  const sigstoreVersion = requireSigstore('sigstore/package.json').version
  if (sigstoreVersion !== '5.0.0') {
    throw new Error(`Expected sigstore 5.0.0, received ${sigstoreVersion}.`)
  }

  const artifactBytes = readFileSync(join(releaseDir, 'release-artifact.json'))
  const artifact = JSON.parse(artifactBytes.toString('utf8'))
  const sigstoreOptions = createSigstoreOptions(artifact.commit)
  const verifier = await createVerifier(sigstoreOptions)
  const verification = await createRegistryVerification({
    artifact,
    artifactBytes,
    releaseDir,
    view: npmView,
    verifyBundle: (bundle, options) => {
      if (!isDeepStrictEqual(options, sigstoreOptions)) {
        throw new Error(
          'Sigstore verification policy differs from the certified policy.',
        )
      }
      return verifier.verify(bundle)
    },
    fetchAttestations: fetchNpmAttestations,
  })

  writeFileSync(
    join(releaseDir, 'registry-verification.json'),
    `${JSON.stringify(verification, null, 2)}\n`,
    { flag: 'wx' },
  )
  if (summaryPath) {
    appendFileSync(
      summaryPath,
      `${[
        '',
        '## npm registry verification',
        '',
        ...verification.packages.map(
          (pkg) => `- \`${pkg.name}@${pkg.version}\`: \`${pkg.mode}\``,
        ),
        '',
        'Existing OIDC packages were cryptographically verified with Sigstore 5.0.0.',
        '',
      ].join('\n')}\n`,
    )
  }
  process.stdout.write(
    `npm registry verification recorded for ${verification.version}: ${verification.packages
      .map((pkg) => `${pkg.name}=${pkg.mode}`)
      .join(', ')}\n`,
  )
}

function digest(value, algorithm) {
  return createHash(algorithm).update(value).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main()
}
