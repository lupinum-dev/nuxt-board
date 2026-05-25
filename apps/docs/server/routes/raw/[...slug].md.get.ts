import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { withLeadingSlash } from 'ufo'

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?/
const contentRoot = join(process.cwd(), 'content')

async function contentFiles(directory = contentRoot): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const child = join(directory, entry.name)
      if (entry.isDirectory()) return contentFiles(child)
      return child.endsWith('.md') ? [child] : []
    }),
  )

  return files.flat()
}

function normalizeContentPath(file: string): string {
  const withoutRoot = relative(contentRoot, file)
    .split(sep)
    .join('/')
    .replace(/\.md$/, '')
    .split('/')
    .map((segment) => segment.replace(/^\d+\./, ''))
    .join('/')
    .replace(/\/index$/, '')

  return withoutRoot === 'index' ? '/' : withLeadingSlash(withoutRoot)
}

async function findContentFile(path: string): Promise<string | null> {
  for (const file of await contentFiles()) {
    if (normalizeContentPath(file) === path) return file
  }

  return null
}

function frontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null
}

function toRawMarkdown(source: string): string {
  const match = source.match(frontmatterPattern)
  if (!match) return source

  const title = frontmatterValue(match[1]!, 'title')
  const description = frontmatterValue(match[1]!, 'description')
  const body = source.slice(match[0].length).trimStart()
  const header = [title ? `# ${title}` : null, description]
    .filter(Boolean)
    .join('\n\n')

  return header ? `${header}\n\n${body}` : body
}

export default eventHandler(async (event) => {
  const slug = getRouterParams(event)['slug.md']
  if (!slug?.endsWith('.md')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page not found',
      fatal: true,
    })
  }

  const requestedPath =
    slug === 'index.md' ? '/' : withLeadingSlash(slug.replace(/\.md$/, ''))
  const file = await findContentFile(requestedPath)
  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page not found',
      fatal: true,
    })
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  return toRawMarkdown(await readFile(file, 'utf8'))
})
