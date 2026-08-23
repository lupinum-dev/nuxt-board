import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CERTIFICATE_OIDS,
  PREDICATE_TYPE,
  PUBLISH_ORDER,
  STATEMENT_TYPE,
  WORKFLOW,
  createRegistryVerification,
  fetchNpmAttestations,
} from './verify-registry-provenance.mjs'

const sourceSha = 'a'.repeat(40)
const version = '1.2.3'

const absent = await runFixture()
assert.deepEqual(
  absent.verification.packages.map((pkg) => pkg.name),
  PUBLISH_ORDER,
)
assert(absent.verification.packages.every((pkg) => pkg.mode === 'absent'))
assert.equal(absent.verification.sourceSha, sourceSha)
assert.equal(absent.verification.sigstoreVersion, '5.0.0')

const oidcModes = Object.fromEntries(
  PUBLISH_ORDER.map((name) => [name, 'oidc']),
)
const oidc = await runFixture({ modes: oidcModes })
assert(oidc.verification.packages.every((pkg) => pkg.mode === 'oidc'))
assert(
  oidc.verification.packages.every((pkg) =>
    /^[0-9a-f]{64}$/u.test(pkg.provenanceBundleSha256),
  ),
)
assert.equal(oidc.verifyCalls.length, PUBLISH_ORDER.length)

for (const [name, url] of [
  [
    'credentials',
    'https://user:password@registry.npmjs.org/-/npm/v1/attestations/fixture',
  ],
  [
    'query',
    'https://registry.npmjs.org/-/npm/v1/attestations/fixture?redirect=1',
  ],
  ['hash', 'https://registry.npmjs.org/-/npm/v1/attestations/fixture#fragment'],
  [
    'alternate port',
    'https://registry.npmjs.org:444/-/npm/v1/attestations/fixture',
  ],
  ['wrong API path', 'https://registry.npmjs.org/package/attestations'],
]) {
  await assert.rejects(
    runFixture({ modes: oidcModes, attestationUrl: url }),
    /Untrusted npm attestation URL/u,
    `${name} URL must fail before fetching`,
  )
}

const validAttestationUrl =
  'https://registry.npmjs.org/-/npm/v1/attestations/redirect-fixture'
let redirectRequest
await assert.rejects(
  fetchNpmAttestations(validAttestationUrl, async (url, request) => {
    redirectRequest = { request, url }
    throw new TypeError('redirect rejected')
  }),
  /redirect rejected/u,
)
assert.equal(redirectRequest.url.href, validAttestationUrl)
assert.equal(redirectRequest.request.redirect, 'error')
assert.equal(redirectRequest.request.headers.Accept, 'application/json')
assert(redirectRequest.request.signal instanceof AbortSignal)
assert.equal(redirectRequest.request.signal.aborted, false)

const mixedModes = {
  [PUBLISH_ORDER[0]]: 'bootstrap',
  [PUBLISH_ORDER[1]]: 'oidc',
  [PUBLISH_ORDER[2]]: 'absent',
  [PUBLISH_ORDER[3]]: 'oidc',
  [PUBLISH_ORDER[4]]: 'bootstrap',
}
const mixed = await runFixture({ modes: mixedModes })
assert.deepEqual(
  Object.fromEntries(
    mixed.verification.packages.map((pkg) => [pkg.name, pkg.mode]),
  ),
  mixedModes,
)

await assert.rejects(
  runFixture({ modes: oidcModes, differentBytes: PUBLISH_ORDER[0] }),
  /exists with different bytes/u,
)
await assert.rejects(
  runFixture({ modes: mixedModes, wrongTag: PUBLISH_ORDER[1] }),
  /does not own the latest npm tag/u,
)
await assert.rejects(
  runFixture({
    modes: mixedModes,
    extraVersion: PUBLISH_ORDER[0],
  }),
  /not the sole first package version/u,
)

for (const [name, mutation, expected] of [
  ['signature', { invalidSignature: true }, /signature is invalid/u],
  ['tarball digest', { wrongSha512: true }, /exact npm tarball SHA-512/u],
  ['source', { wrongSource: true }, /certified source SHA/u],
  ['workflow', { wrongWorkflow: true }, /publish\.yml on main/u],
  ['builder', { wrongBuilder: true }, /GitHub-hosted Actions/u],
  ['subject', { wrongSubject: true }, /exact npm tarball SHA-512/u],
]) {
  await assert.rejects(
    runFixture({ modes: oidcModes, ...mutation }),
    expected,
    `${name} mutation must fail`,
  )
}

for (const oid of Object.values(CERTIFICATE_OIDS)) {
  await assert.rejects(
    runFixture({ modes: oidcModes, missingCertificateOid: oid }),
    /certificate OID differs/u,
  )
  await assert.rejects(
    runFixture({ modes: oidcModes, wrongCertificateOid: oid }),
    /certificate OID differs/u,
  )
}

process.stdout.write('Registry provenance fixtures passed.\n')

async function runFixture(options = {}) {
  const releaseDir = mkdtempSync(join(tmpdir(), 'nuxt-board-provenance-'))
  try {
    const modes = options.modes ?? {}
    const packages = [...PUBLISH_ORDER].sort().map((name, index) => {
      const filename = `package-${index + 1}.tgz`
      const bytes = Buffer.from(`${name}@${version}`)
      writeFileSync(join(releaseDir, filename), bytes)
      return {
        name,
        version,
        filename,
        sha1: digest(bytes, 'sha1'),
        sha256: digest(bytes, 'sha256'),
        bytes,
      }
    })
    const artifact = {
      commit: sourceSha,
      version,
      channel: 'latest',
      packages: packages.map(({ bytes: _, ...pkg }) => pkg),
    }
    const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`)
    const registry = new Map()
    for (const pkg of packages) {
      const mode = modes[pkg.name] ?? 'absent'
      if (mode === 'absent') continue
      const provenance = provenanceFixture({
        bytes: pkg.bytes,
        pkg,
        sourceSha,
        ...options,
      })
      const versions = [pkg.version]
      if (options.extraVersion === pkg.name) versions.push('1.2.4')
      registry.set(pkg.name, {
        versions,
        tags: {
          latest: options.wrongTag === pkg.name ? '1.2.2' : pkg.version,
        },
        releases: {
          [pkg.version]: {
            sha1:
              options.differentBytes === pkg.name ? '0'.repeat(40) : pkg.sha1,
            attestations:
              mode === 'oidc'
                ? {
                    url:
                      options.attestationUrl ??
                      `https://registry.npmjs.org/-/npm/v1/attestations/${packages.indexOf(pkg)}`,
                  }
                : null,
            document: provenance.document,
          },
        },
      })
    }

    const verifyCalls = []
    const verification = await createRegistryVerification({
      artifact,
      artifactBytes,
      releaseDir,
      view: (spec, field) => fixtureView(registry, spec, field),
      fetchAttestations: async (url) => {
        const index = Number(url.split('/').at(-1))
        const pkg = packages[index]
        return registry.get(pkg.name).releases[version].document
      },
      verifyBundle: async (bundle, verificationOptions) => {
        verifyCalls.push(verificationOptions)
        if (options.invalidSignature) throw new Error('signature is invalid')
        for (const [oid, expected] of Object.entries(
          verificationOptions.certificateOIDs ?? {},
        )) {
          if (bundle.fixtureCertificateOIDs?.[oid] !== expected) {
            throw new Error(`certificate OID differs: ${oid}`)
          }
        }
      },
    })
    return { verification, verifyCalls }
  } finally {
    rmSync(releaseDir, { recursive: true, force: true })
  }
}

function fixtureView(registry, spec, field) {
  const match = /^(@[^/]+\/[^@]+)@(.+)$/u.exec(spec)
  const name = match?.[1] ?? spec
  const packageVersion = match?.[2]
  const pkg = registry.get(name)
  const release = packageVersion ? pkg?.releases?.[packageVersion] : null
  if (field === 'version') return release ? packageVersion : null
  if (field === 'dist.shasum') return release?.sha1 ?? null
  if (field === 'dist.attestations') return release?.attestations ?? null
  if (field === 'versions') return pkg?.versions ?? null
  if (field.startsWith('dist-tags.')) {
    return pkg?.tags?.[field.slice('dist-tags.'.length)] ?? null
  }
  throw new Error(`Unsupported npm view fixture: ${spec} ${field}`)
}

function provenanceFixture({
  bytes,
  missingCertificateOid,
  pkg,
  sourceSha: exactSourceSha,
  wrongBuilder,
  wrongCertificateOid,
  wrongSha512,
  wrongSource,
  wrongSubject,
  wrongWorkflow,
}) {
  const statement = {
    _type: STATEMENT_TYPE,
    predicateType: PREDICATE_TYPE,
    subject: [
      {
        name: wrongSubject
          ? `pkg:npm/%40lupinum/wrong@${pkg.version}`
          : `pkg:npm/${pkg.name.replaceAll('@', '%40')}@${pkg.version}`,
        digest: {
          sha512: wrongSha512 ? '0'.repeat(128) : digest(bytes, 'sha512'),
        },
      },
    ],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            repository: WORKFLOW.repository,
            path: wrongWorkflow ? '.github/workflows/other.yml' : WORKFLOW.path,
            ref: WORKFLOW.ref,
          },
        },
        resolvedDependencies: [
          {
            uri: WORKFLOW.sourceDependency,
            digest: {
              gitCommit: wrongSource ? 'b'.repeat(40) : exactSourceSha,
            },
          },
        ],
      },
      runDetails: {
        builder: {
          id: wrongBuilder
            ? 'https://example.test/runner'
            : 'https://github.com/actions/runner/github-hosted',
        },
      },
    },
  }
  const fixtureCertificateOIDs = {
    [CERTIFICATE_OIDS.sourceSha]: exactSourceSha,
    [CERTIFICATE_OIDS.repository]: WORKFLOW.repositorySlug,
    [CERTIFICATE_OIDS.ref]: WORKFLOW.ref,
  }
  if (missingCertificateOid)
    delete fixtureCertificateOIDs[missingCertificateOid]
  if (wrongCertificateOid) {
    fixtureCertificateOIDs[wrongCertificateOid] = 'mismatched-value'
  }
  const bundle = {
    dsseEnvelope: {
      payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
      payloadType: 'application/vnd.in-toto+json',
    },
    fixtureCertificateOIDs,
  }
  return {
    document: {
      attestations: [{ predicateType: PREDICATE_TYPE, bundle }],
    },
  }
}

function digest(value, algorithm) {
  return createHash(algorithm).update(value).digest('hex')
}
