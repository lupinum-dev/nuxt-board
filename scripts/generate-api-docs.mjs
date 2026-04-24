import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import prettier from 'prettier'

const root = process.cwd()

const packages = [
  {
    slug: '1.board-core',
    title: '@lupinum/board-core',
    description: 'Headless engine, math helpers, and shared types.',
    install: 'pnpm add @lupinum/board-core',
    source: 'packages/board-core/src/index.ts',
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

function anchorFor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function exportDetails(entries) {
  return entries
    .map((entry) => {
      const notes = entry.notes || `Exported from this package.`
      return `### ${entry.name}\n\n${notes}\n\nKind: \`${entry.kind}\`.`
    })
    .join('\n\n')
}

async function writePackageDoc(pkg) {
  const target = resolve(root, 'packages/docs/content/6.api', `${pkg.slug}.md`)
  const sections = []

  if (pkg.source) {
    const source = await readFile(resolve(root, pkg.source), 'utf8')
    const exports = parseExports(source)
    const rows = exports.map((entry) => [
      `[\`${entry.name}\`](#${anchorFor(entry.name)})`,
      entry.kind,
      entry.notes || `Exported from \`${pkg.title}\`.`,
    ])
    sections.push(`## Exports\n\n${table(rows)}`)
    sections.push(`## Export Details\n\n${exportDetails(exports)}`)
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
  const prettierOptions = await prettier.resolveConfig(target)
  const formatted = await prettier.format(body, {
    ...prettierOptions,
    filepath: target,
  })
  await writeFile(target, formatted)
}

await Promise.all(packages.map(writePackageDoc))
