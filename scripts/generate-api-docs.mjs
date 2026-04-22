import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = process.cwd()

const packages = [
  {
    slug: '1.board-core',
    title: '@lupinum/board-core',
    description: 'Headless engine, math helpers, and shared types.',
    install: 'pnpm add @lupinum/board-core',
    source: 'packages/board-core/src/index.ts',
  },
  {
    slug: '2.vue-board',
    title: '@lupinum/vue-board',
    description: 'Vue components and composables for interactive boards.',
    install: 'pnpm add @lupinum/vue-board @lupinum/board-core',
    source: 'packages/vue-board/src/index.ts',
  },
  {
    slug: '3.nuxt-board',
    title: '@lupinum/nuxt-board',
    description: 'Nuxt module with component and composable auto-imports.',
    install: 'pnpm add @lupinum/nuxt-board',
    manualSections: [
      {
        heading: 'Module options',
        rows: [
          [
            '`prefix`',
            'string',
            'Prefixes auto-imported board component names.',
          ],
          [
            '`autoImportComponents`',
            'boolean',
            'Enables `Board*` component auto-imports.',
          ],
          [
            '`autoImportComposables`',
            'boolean',
            'Enables `useBoardEngine`, `useCamera`, and related composables.',
          ],
        ],
      },
      {
        heading: 'Auto-imports',
        rows: [
          [
            'Components',
            '`BoardRoot`, `BoardViewport`, `BoardNode`, `BoardNodeHandle`, `BoardGrid`, `BoardBoxSelect`, `BoardSnapGuides`',
            'Template globals injected by the module.',
          ],
          [
            'Composables',
            '`useBoardEngine`, `useCamera`, `useNodes`, `useSelection`, `useInteraction`, `useVisibleBounds`, `useVisibleNodes`, `useGridStyle`, `useNode`, `useBoxSelectBounds`, `createBoardEngine`',
            'Runtime helpers available without manual imports.',
          ],
        ],
      },
    ],
  },
  {
    slug: '4.board-connections',
    title: '@lupinum/board-connections',
    description: 'Edge data model, routing helpers, and connection layer.',
    install: 'pnpm add @lupinum/board-connections @lupinum/vue-board',
    source: 'packages/board-connections/src/index.ts',
  },
  {
    slug: '5.board-minimap',
    title: '@lupinum/board-minimap',
    description: 'Minimap composable and renderer for large boards.',
    install: 'pnpm add @lupinum/board-minimap @lupinum/vue-board',
    source: 'packages/board-minimap/src/index.ts',
  },
  {
    slug: '6.board-history',
    title: '@lupinum/board-history',
    description: 'Undo and redo support.',
    install: 'pnpm add @lupinum/board-history @lupinum/board-core',
    source: 'packages/board-history/src/index.ts',
  },
  {
    slug: '7.board-selection',
    title: '@lupinum/board-selection',
    description: 'Selection helpers for current snapshots.',
    install: 'pnpm add @lupinum/board-selection @lupinum/board-core',
    source: 'packages/board-selection/src/index.ts',
  },
  {
    slug: '8.board-serializer',
    title: '@lupinum/board-serializer',
    description: 'JSON Canvas import and export helpers.',
    install: 'pnpm add @lupinum/board-serializer @lupinum/board-core',
    source: 'packages/board-serializer/src/index.ts',
  },
]

function classify(name, isType) {
  if (isType) return 'Type'
  if (name.startsWith('Board')) return 'Component / object'
  if (name.startsWith('use')) return 'Composable'
  if (name.startsWith('create')) return 'Factory'
  if (name.endsWith('Plugin') || name.endsWith('plugin')) return 'Plugin'
  return 'Function'
}

function cleanDocBlock(block) {
  const lines = block
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())

  const summary = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('@')) break
    if (trimmed === '' && summary.length > 0) break
    if (trimmed) {
      summary.push(trimmed)
    }
  }

  return summary.join(' ').trim()
}

function findLeadingDoc(source, exportIndex) {
  let end = exportIndex
  while (end > 0 && /\s/.test(source[end - 1])) {
    end -= 1
  }

  if (source.slice(end - 2, end) !== '*/') {
    return ''
  }

  const start = source.lastIndexOf('/**', end - 2)
  if (start === -1) {
    return ''
  }

  const close = source.indexOf('*/', start)
  if (close !== end - 2) {
    return ''
  }

  return cleanDocBlock(source.slice(start + 3, close))
}

function parseExports(source) {
  const entries = []
  const patterns = [
    {
      regex: /export\s+(type\s+)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gms,
      map(match) {
        const note = findLeadingDoc(source, match.index)
        const names = match[2]
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            const inlineType = entry.startsWith('type ')
            const normalized = inlineType ? entry.slice(5).trim() : entry
            const defaultMatch = normalized.match(/^default\s+as\s+(.+)$/)
            const aliasMatch = normalized.match(/^(.+?)\s+as\s+(.+)$/)
            const name = (
              defaultMatch
                ? defaultMatch[1]
                : aliasMatch
                  ? aliasMatch[2]
                  : normalized
            ).trim()

            return {
              name,
              kind: classify(name, Boolean(match[1]) || inlineType),
              notes: note,
            }
          })

        return names
      },
    },
    {
      regex: /export\s+interface\s+([A-Za-z0-9_]+)/gms,
      map(match) {
        const name = match[1]
        return [
          {
            name,
            kind: classify(name, true),
            notes: findLeadingDoc(source, match.index),
          },
        ]
      },
    },
    {
      regex: /export\s+type\s+([A-Za-z0-9_]+)/gms,
      map(match) {
        const name = match[1]
        return [
          {
            name,
            kind: classify(name, true),
            notes: findLeadingDoc(source, match.index),
          },
        ]
      },
    },
    {
      regex: /export\s+function\s+([A-Za-z0-9_]+)/gms,
      map(match) {
        const name = match[1]
        return [
          {
            name,
            kind: classify(name, false),
            notes: findLeadingDoc(source, match.index),
          },
        ]
      },
    },
    {
      regex: /export\s+const\s+([A-Za-z0-9_]+)/gms,
      map(match) {
        const name = match[1]
        return [
          {
            name,
            kind: classify(name, false),
            notes: findLeadingDoc(source, match.index),
          },
        ]
      },
    },
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      entries.push(...pattern.map(match))
    }
  }

  const deduped = new Map()
  for (const entry of entries) {
    if (!deduped.has(entry.name)) {
      deduped.set(entry.name, entry)
    }
  }

  return [...deduped.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )
}

function table(rows) {
  const header = '| Name | Kind | Notes |\n| --- | --- | --- |'
  return [
    header,
    ...rows.map(([name, kind, notes]) => `| ${name} | ${kind} | ${notes} |`),
  ].join('\n')
}

async function writePackageDoc(pkg) {
  const target = resolve(root, 'packages/docs/content/4.api', `${pkg.slug}.md`)
  const sections = []

  if (pkg.source) {
    const source = await readFile(resolve(root, pkg.source), 'utf8')
    const exports = parseExports(source)
    const rows = exports.map((entry) => [
      `\`${entry.name}\``,
      entry.kind,
      entry.notes || `Exported from \`${pkg.title}\`.`,
    ])
    sections.push(`## Exports\n\n${table(rows)}`)
  }

  for (const section of pkg.manualSections ?? []) {
    sections.push(`## ${section.heading}\n\n${table(section.rows)}`)
  }

  const body = `---
title: "${pkg.title}"
description: "${pkg.description}"
---

## Install

\`\`\`bash
${pkg.install}
\`\`\`

${sections.join('\n\n')}
`

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body)
}

await Promise.all(packages.map(writePackageDoc))
