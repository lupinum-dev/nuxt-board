import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = process.cwd()

const packages = [
  {
    slug: '1.board-core',
    title: '@lupinum/board-core',
    description: 'Headless engine, math helpers, and shared types.',
    install: 'pnpm add @lupinum/board-core',
    source: 'packages/board-core/src/index.ts'
  },
  {
    slug: '2.vue-board',
    title: '@lupinum/vue-board',
    description: 'Vue components and composables for interactive boards.',
    install: 'pnpm add @lupinum/vue-board @lupinum/board-core',
    source: 'packages/vue-board/src/index.ts'
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
          ['`prefix`', 'string', 'Prefixes auto-imported board component names.'],
          ['`autoImportComponents`', 'boolean', 'Enables `Board*` component auto-imports.'],
          ['`autoImportComposables`', 'boolean', 'Enables `useBoardEngine`, `useCamera`, and related composables.']
        ]
      },
      {
        heading: 'Auto-imports',
        rows: [
          ['Components', '`BoardRoot`, `BoardViewport`, `BoardNode`, `BoardNodeHandle`, `BoardGrid`, `BoardBoxSelect`, `BoardSnapGuides`', 'Template globals injected by the module.'],
          ['Composables', '`useBoardEngine`, `useCamera`, `useNodes`, `useSelection`, `useInteraction`, `useVisibleBounds`, `useVisibleNodes`, `useGridStyle`, `useNode`, `useBoxSelectBounds`, `createBoardEngine`', 'Runtime helpers available without manual imports.']
        ]
      }
    ]
  },
  {
    slug: '4.board-connections',
    title: '@lupinum/board-connections',
    description: 'Edge data model, routing helpers, and connection layer.',
    install: 'pnpm add @lupinum/board-connections @lupinum/vue-board',
    source: 'packages/board-connections/src/index.ts'
  },
  {
    slug: '5.board-minimap',
    title: '@lupinum/board-minimap',
    description: 'Minimap composable and renderer for large boards.',
    install: 'pnpm add @lupinum/board-minimap @lupinum/vue-board',
    source: 'packages/board-minimap/src/index.ts'
  },
  {
    slug: '6.board-history',
    title: '@lupinum/board-history',
    description: 'Undo and redo support.',
    install: 'pnpm add @lupinum/board-history @lupinum/board-core',
    source: 'packages/board-history/src/index.ts'
  },
  {
    slug: '7.board-selection',
    title: '@lupinum/board-selection',
    description: 'Selection helpers for current snapshots.',
    install: 'pnpm add @lupinum/board-selection @lupinum/board-core',
    source: 'packages/board-selection/src/index.ts'
  },
  {
    slug: '8.board-serializer',
    title: '@lupinum/board-serializer',
    description: 'JSON Canvas import and export helpers.',
    install: 'pnpm add @lupinum/board-serializer @lupinum/board-core',
    source: 'packages/board-serializer/src/index.ts'
  }
]

function classify(name, isType) {
  if (isType) return 'Type'
  if (name.startsWith('Board')) return 'Component / object'
  if (name.startsWith('use')) return 'Composable'
  if (name.startsWith('create')) return 'Factory'
  if (name.endsWith('Plugin') || name.endsWith('plugin')) return 'Plugin'
  return 'Function'
}

function parseExports(source) {
  const entries = []
  const blockPattern = /export\s+(type\s+)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gms
  for (const match of source.matchAll(blockPattern)) {
    const isType = Boolean(match[1])
    const names = match[2]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const defaultMatch = entry.match(/^default\s+as\s+(.+)$/)
        if (defaultMatch) return defaultMatch[1].trim()
        const aliasMatch = entry.match(/^(.+?)\s+as\s+(.+)$/)
        return (aliasMatch ? aliasMatch[2] : entry).trim()
      })

    for (const name of names) {
      entries.push({ name, kind: classify(name, isType) })
    }
  }
  return entries
}

function table(rows) {
  const header = '| Name | Kind | Notes |\n| --- | --- | --- |'
  return [header, ...rows.map(([name, kind, notes]) => `| ${name} | ${kind} | ${notes} |`)].join('\n')
}

async function writePackageDoc(pkg) {
  const target = resolve(root, 'packages/docs/content/4.api', `${pkg.slug}.md`)
  const sections = []

  if (pkg.source) {
    const source = await readFile(resolve(root, pkg.source), 'utf8')
    const exports = parseExports(source)
    const rows = exports.map((entry) => [`\`${entry.name}\``, entry.kind, `Exported from \`${pkg.title}\`.`])
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
