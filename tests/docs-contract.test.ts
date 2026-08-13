import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as boardCore from '@lupinum/board-core'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import * as boardConnections from '@lupinum/board-connections'
import { createDemoDocument } from '../apps/docs/app/utils/demoDocument'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
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
  it('keeps every public README on the Lupinum structure', () => {
    const readmes = [
      'README.md',
      'packages/board-connections/README.md',
      'packages/board-core/README.md',
      'packages/board-history/README.md',
      'packages/nuxt-board/README.md',
      'packages/vue-board/README.md',
    ]

    for (const file of readmes) {
      const source = read(file)
      const headings = Array.from(source.matchAll(/^## (.+)$/gm), (match) =>
        match[1]!.trim(),
      )
      const h1Count =
        (source.match(/^# /gm)?.length ?? 0) +
        (source.match(/<h1\b/gu)?.length ?? 0)

      expect(h1Count, file).toBe(1)
      expect(source, file).toContain('width="128"')
      expect(source, file).toContain('https://nuxt-board.lupinum.com')
      expect(source, file).toContain(
        'https://github.com/lupinum-dev/nuxt-board',
      )
      expect(source, file).toContain('MIT License')
      expect(source, file).not.toMatch(/\b(?:TODO|TBD|PLACEHOLDER)\b/i)

      for (const heading of headings) {
        const words = heading.split(/\s+/).slice(1)
        expect(
          words.filter((word) => /^[A-Z][A-Za-z-]*$/.test(word)),
          `${file}: ${heading}`,
        ).toEqual(
          words.filter(
            (word) =>
              /^[A-Z][A-Za-z-]*$/.test(word) &&
              ['API', 'Nuxt', 'Vue'].includes(word),
          ),
        )
      }
    }

    const rootReadme = read('README.md')
    for (const badge of ['npm/v/', 'actions/workflows/ci.yml', 'license-MIT']) {
      expect(rootReadme).toContain(badge)
    }

    const orderedSections = [
      'Why use Nuxt Board?',
      'When to use it',
      'Requirements',
      'Installation',
      'Quick start',
      'How it works',
      'Main capabilities',
      'Packages',
      'Documentation',
      'Contributing and development',
      'Support and security',
      'License',
    ]
    expect(
      orderedSections.map((heading) => rootReadme.indexOf(`## ${heading}`)),
    ).toEqual(
      [...orderedSections]
        .map((heading) => rootReadme.indexOf(`## ${heading}`))
        .sort((left, right) => left - right),
    )
    expect(
      orderedSections.every((heading) => rootReadme.includes(`## ${heading}`)),
    ).toBe(true)
  })

  it('keeps every package license identical to the repository license', () => {
    const canonical = read('LICENSE')

    for (const file of [
      'packages/board-connections/LICENSE',
      'packages/board-core/LICENSE',
      'packages/board-history/LICENSE',
      'packages/nuxt-board/LICENSE',
      'packages/vue-board/LICENSE',
    ]) {
      expect(read(file), file).toBe(canonical)
    }
  })

  it('documents only public board-core utility exports', () => {
    const source = read(
      'apps/docs/content/docs/6.reference/2.board-core.md',
    ).split('## Math helpers')[1]!
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
      'apps/docs/content/docs/6.reference/2.board-core.md',
      'ARCHITECTURE.md',
      'packages/board-core/README.md',
    ]) {
      const source = read(file)

      expect(source, file).toContain('@lupinum/board-core/internal')
      expect(source, file).toContain('first-party')
    }
  })

  it('documents public board-connections utility exports', () => {
    const source = read('apps/docs/content/docs/6.reference/6.connections.md')

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

  it('keeps docs frontmatter complete', () => {
    const files = filesIn('apps/docs/content/docs').filter(
      (file) => file.endsWith('.md') && !file.endsWith('/index.md'),
    )

    for (const file of files) {
      const source = read(file)
      expect(source, file).toMatch(/^---\n/)
      expect(source, file).toMatch(/^audience:\s/m)
      expect(source, file).toMatch(/^intent:\s/m)
    }
  })

  it('keeps public docs free of generic closing sections and duplicate titles', () => {
    const files = filesIn('apps/docs/content/docs').filter((file) =>
      file.endsWith('.md'),
    )

    for (const file of files) {
      const source = read(file)
      const body = source.replace(/^---\n[\s\S]*?\n---\n/, '')
      const title = source.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)?.[1]

      expect(body, file).not.toMatch(/^# /m)
      expect(body, file).not.toMatch(/^## (Related|Conclusion|Next)$/m)
      expect(body, file).not.toMatch(
        /\b(?:aren['’]t|can['’]t|couldn['’]t|didn['’]t|doesn['’]t|don['’]t|hadn['’]t|hasn['’]t|haven['’]t|isn['’]t|it['’]s|shouldn['’]t|that['’]s|there['’]s|they['’]re|we['’]re|weren['’]t|what['’]s|won['’]t|wouldn['’]t|you['’]ll|you['’]re)\b/i,
      )

      if (title) {
        const uppercaseWords = title
          .split(/\s+/)
          .slice(1)
          .filter((word) => /^[A-Z][A-Za-z-]*$/.test(word))

        expect(uppercaseWords, file).toEqual(
          uppercaseWords.filter((word) =>
            ['API', 'Board', 'Canvas', 'JSON', 'Nuxt', 'SSR', 'Vue'].includes(
              word,
            ),
          ),
        )
      }
    }
  })

  it('keeps security reporting contact consistent', () => {
    expect(read('SECURITY.md')).toContain('info@lupinum.com')
    expect(
      read('apps/docs/content/docs/7.project/2.support-and-security.md'),
    ).toContain('info@lupinum.com')
  })

  it('does not pass runtime snapshots directly to loadDocument in demos', () => {
    const files = readdirSync(resolve(root, 'apps/docs/app/components/demos'))
      .filter((file) => file.endsWith('.vue'))
      .map((file) => `apps/docs/app/components/demos/${file}`)

    for (const file of files) {
      const source = read(file)

      expect(source, file).not.toMatch(
        /loadDocument\(\s*JSON\.stringify\(\s*\{/s,
      )
      expect(source, file).not.toMatch(/\bsnapGuides:\s*\[/)
      expect(source, file).not.toMatch(/\binteraction:\s*\{\s*mode:/)
    }

    expect(read('packages/nuxt-board/playground/lib/demo.ts')).not.toMatch(
      /loadDocument\(\s*JSON\.stringify\(\s*\{/s,
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

    engine.loadDocument(document, { mode: 'replace' })

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
