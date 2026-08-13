export function extractGeneratedRelease(stdout, version) {
  const normalized = stdout.replaceAll('\r\n', '\n')
  const heading = /^##\s+[^\n]+$/mu.exec(normalized)
  if (!heading?.index && heading?.index !== 0) {
    throw new Error('Changelogen did not produce a Markdown release section.')
  }

  const sectionStart = heading.index
  const nextHeading = normalized.indexOf(
    '\n## ',
    sectionStart + heading[0].length,
  )
  const section = normalized
    .slice(sectionStart, nextHeading === -1 ? undefined : nextHeading)
    .replace(/^##\s+[^\n]+/u, `## v${version}`)
    .trim()

  if (!section.startsWith(`## v${version}\n`)) {
    throw new Error('Changelogen did not produce a usable release section.')
  }
  return section
}

export function mergeReleaseSection(current, generated, version) {
  const normalizedCurrent = current.replaceAll('\r\n', '\n').trimEnd()
  const marker = `## v${version}`
  const markerAt = normalizedCurrent.startsWith(marker)
    ? 0
    : normalizedCurrent.indexOf(`\n${marker}`) + 1

  if (markerAt > 0 || normalizedCurrent.startsWith(marker)) {
    return `${normalizedCurrent}\n`
  }

  return `${normalizedCurrent}\n\n${generated}\n`
}
