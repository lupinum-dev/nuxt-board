import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as boardCore from '@lupinum/board-core'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import * as boardConnections from '@lupinum/board-connections'
import playwrightConfig from '../playwright.config'
import { createDemoDocument } from '../apps/docs/app/utils/demoDocument'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type PackageManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(read(path)) as PackageManifest
}

function filesIn(path: string): string[] {
  return readdirSync(resolve(root, path), { withFileTypes: true }).flatMap(
    (entry) => {
      const child = `${path}/${entry.name}`
      return entry.isDirectory() ? filesIn(child) : [child]
    },
  )
}

describe('docs demo contracts', () => {
  it('keeps docs as an app, not a publishable package', () => {
    expect(() => read('apps/docs/package.json')).not.toThrow()
    expect(() => read('packages/docs/package.json')).toThrow()
  })

  it('keeps docs builds aligned with the Vercel deployment target', () => {
    const manifest = readManifest('apps/docs/package.json')
    const directDependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }

    expect(manifest.scripts?.build).toContain('--preset vercel')
    expect(directDependencies).not.toHaveProperty('@nuxtjs/mdc')
    expect(directDependencies).not.toHaveProperty('unist-util-visit')
  })

  it('keeps default e2e runs deterministic', () => {
    const webServers = Array.isArray(playwrightConfig.webServer)
      ? playwrightConfig.webServer
      : [playwrightConfig.webServer]

    expect(playwrightConfig.workers).toBe(1)
    expect(playwrightConfig.fullyParallel).not.toBe(true)
    expect(webServers).toHaveLength(2)
    expect(
      webServers.every((server) => server?.reuseExistingServer === false),
    ).toBe(true)
    expect(webServers[1]?.env).toMatchObject({
      FORCE_COLOR: '0',
      NUXT_PUBLIC_SITE_URL: 'http://127.0.0.1:4174/',
    })
  })

  it('keeps TypeScript responsible for unused workspace code', () => {
    const config = JSON.parse(read('tsconfig.json')) as {
      compilerOptions?: {
        noUnusedLocals?: boolean
        noUnusedParameters?: boolean
      }
    }

    expect(config.compilerOptions?.noUnusedLocals).toBe(true)
    expect(config.compilerOptions?.noUnusedParameters).toBe(true)
  })

  it('keeps workflows pointed at existing release gates', () => {
    for (const file of [
      '.github/workflows/ci.yml',
      '.github/workflows/docs.yml',
      '.github/workflows/release.yml',
    ]) {
      expect(read(file), file).not.toContain('pnpm docs:api')
    }

    expect(read('.github/workflows/docs.yml')).not.toContain('packages/docs')
    expect(read('.github/workflows/ci.yml')).toContain('pnpm audit --prod')
    expect(read('.github/workflows/release.yml')).toContain('pnpm audit --prod')
  })

  it('keeps handoff docs aligned with the release-facing checks', () => {
    const checks = [
      'pnpm format:check',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test:unit',
      'pnpm test:docs',
      'pnpm pack:check',
      'pnpm test:e2e',
      'pnpm audit --prod --audit-level high',
    ]

    for (const file of [
      'README.md',
      'apps/docs/content/8.oss/1.contributing.md',
      'apps/docs/content/8.oss/2.release-workflow.md',
    ]) {
      const source = read(file)
      for (const check of checks) {
        expect(source, `${file} should mention ${check}`).toContain(check)
      }
    }
  })

  it('documents only public board-core utility exports', () => {
    const source = read('apps/docs/content/6.api/3.board-core-math.md')
    const documentedHelpers = Array.from(
      source.matchAll(/^### ([A-Za-z_$][\w$]*)$/gm),
      (match) => match[1]!,
    )

    expect(documentedHelpers).not.toEqual([])
    for (const helper of documentedHelpers) {
      expect(boardCore, helper).toHaveProperty(helper)
    }
  })

  it('documents the board-core internal subpath as first-party ABI only', () => {
    for (const file of [
      'apps/docs/content/6.api/1.board-core.md',
      'ARCHITECTURE.md',
      'packages/board-core/README.md',
    ]) {
      const source = read(file)

      expect(source, file).toContain('@lupinum/board-core/internal')
      expect(source, file).toContain('first-party')
    }
  })

  it('documents public board-connections utility exports', () => {
    const source = read('apps/docs/content/6.api/7.board-connections.md')

    for (const helper of [
      'resolveAnchorPoint',
      'resolveAutoAnchorSide',
      'resolveConnectionEndpoint',
      'buildConnectionRoute',
      'buildArcRoute',
      'resolveFloatingEndpoint',
      'resolveEdgeRenderState',
      'getVisibleEdges',
    ]) {
      expect(boardConnections, helper).toHaveProperty(helper)
      expect(source).toContain(`### ${helper}`)
    }
  })

  it('keeps markdown examples copy-pasteable for known drift cases', () => {
    const files = filesIn('apps/docs/content').filter((file) =>
      file.endsWith('.md'),
    )

    for (const file of files) {
      const source = read(file)

      expect(source, file).not.toMatch(/\btext:\s*[,}]/)
      expect(source, file).not.toMatch(/split\('\n'\)/)
      expect(source, file).not.toContain('data.content')
      expect(source, file).not.toContain('x-nuxt-board')
      expect(source, file).not.toContain('class="h-screen"')
    }
  })

  it('serves raw docs from source markdown', () => {
    const source = read('apps/docs/server/routes/raw/[...slug].md.get.ts')

    expect(source).toContain("readFile(file, 'utf8')")
    expect(source).not.toContain('minimark')
    expect(source).not.toContain('queryCollection')
  })

  it('does not initialize client-side content search on page load', () => {
    for (const file of [
      'apps/docs/app/app.vue',
      'apps/docs/app/error.vue',
      'apps/docs/app/components/AppHeader.vue',
    ]) {
      const source = read(file)

      expect(source, file).not.toContain('queryCollectionSearchSections')
      expect(source, file).not.toContain('UContentSearch')
    }
  })

  it('keeps security reporting contact consistent', () => {
    expect(read('SECURITY.md')).toContain('security@lupinum.dev')
    expect(read('apps/docs/content/8.oss/3.support-and-security.md')).toContain(
      'security@lupinum.dev',
    )
  })

  it('does not pass runtime snapshots directly to importDocument in demos', () => {
    const files = readdirSync(resolve(root, 'apps/docs/app/components/demos'))
      .filter((file) => file.endsWith('.vue'))
      .map((file) => `apps/docs/app/components/demos/${file}`)

    for (const file of files) {
      const source = read(file)

      expect(source, file).not.toMatch(/importDocument\(\s*JSON\.stringify\(\s*\{/s)
      expect(source, file).not.toMatch(/\bsnapGuides:\s*\[/)
      expect(source, file).not.toMatch(/\binteraction:\s*\{\s*mode:/)
    }

    expect(read('packages/nuxt-board/playground/lib/demo.ts')).not.toMatch(
      /importDocument\(\s*JSON\.stringify\(\s*\{/s,
    )
  })

  it('imports canonical docs demo documents through the real engine', () => {
    const document = createDemoDocument({
      camera: { x: -20, y: -10, z: 1 },
      grid: createBoardEngine().getGridSettings(),
      selection: [asNodeId('child')],
      nextZIndex: 3,
      nodes: [
        {
          id: asNodeId('group'),
          type: 'group',
          x: 0,
          y: 0,
          width: 360,
          height: 240,
          label: 'Group',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: asNodeId('child'),
          type: 'text',
          x: 40,
          y: 40,
          width: 180,
          height: 90,
          text: 'Child',
          parentId: asNodeId('group'),
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
    })
    const engine = createBoardEngine()

    engine.importDocument(document, 'replace')

    expect(engine.getNode(asNodeId('child')).parentId).toBe(asNodeId('group'))
    expect(engine.exportDocument()).toMatchObject({
      nodes: expect.any(Array),
      'x-vue-board': {
        selection: [asNodeId('child')],
        nodes: {
          child: { parentId: asNodeId('group') },
        },
      },
    })
  })
})
