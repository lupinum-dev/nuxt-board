import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const examples = {
  'basic-board-demo': [
    'app/components/demos/BasicBoardDemo.vue',
    'app/utils/demoDocument.ts',
  ],
  'connections-board-demo': [
    'app/components/demos/ConnectionsBoardDemo.vue',
    'app/utils/demoDocument.ts',
  ],
  'document-session-lab': [
    'app/components/demos/DocumentSessionLab.vue',
    'app/utils/demoDocument.ts',
    'app/components/content/DocsLab.vue',
  ],
  'engine-command-lab': [
    'app/components/demos/EngineCommandLab.vue',
    'app/utils/demoDocument.ts',
    'app/components/content/DocsLab.vue',
  ],
  'event-logger': [
    'app/components/demos/EventLogger.vue',
    'app/utils/demoDocument.ts',
  ],
  'failed-transaction-lab': [
    'app/components/demos/FailedTransactionLab.vue',
    'app/utils/demoDocument.ts',
    'app/components/content/DocsLab.vue',
  ],
  'interaction-state-viz': [
    'app/components/demos/InteractionStateViz.vue',
    'app/utils/demoDocument.ts',
  ],
  'json-import-export-demo': [
    'app/components/demos/JsonImportExportDemo.vue',
    'app/utils/demoDocument.ts',
  ],
  'mind-map-demo': [
    'app/components/demos/MindMapDemo.vue',
    'app/utils/demoDocument.ts',
    'app/components/demos/MindMapTopicNode.vue',
  ],
  'nuxt-auto-imports-demo': [
    'app/components/demos/NuxtAutoImportsDemo.vue',
    'app/utils/demoDocument.ts',
  ],
  'persistence-lab': [
    'app/components/demos/PersistenceLab.vue',
    'app/utils/demoDocument.ts',
    'app/components/content/DocsLab.vue',
  ],
  'read-only-toggle-demo': [
    'app/components/demos/ReadOnlyToggleDemo.vue',
    'app/utils/demoDocument.ts',
  ],
  'renderer-board-demo': [
    'app/components/demos/RendererBoardDemo.vue',
    'app/utils/demoDocument.ts',
    'app/components/demos/DocsInsightNode.vue',
    'app/components/demos/DocsMetricNode.vue',
  ],
  'renderer-lab': [
    'app/components/demos/RendererLab.vue',
    'app/utils/demoDocument.ts',
    'app/components/content/DocsLab.vue',
    'app/components/demos/LabTaskNode.vue',
  ],
  'theme-playground': [
    'app/components/demos/ThemePlayground.vue',
    'app/utils/demoDocument.ts',
  ],
  'workflow-renderer-demo': [
    'app/components/demos/WorkflowRendererDemo.vue',
    'app/utils/demoDocument.ts',
    'app/components/demos/WorkflowStepNode.vue',
  ],
}
const root = new URL('../docs/', import.meta.url)
const raw = new URL('.vercel/output/static/raw/', root)
const seen = new Set()

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) {
      checkDirectory(file)
      continue
    }
    if (!file.endsWith('.md')) continue
    const markdown = readFileSync(file, 'utf8')
    assert(
      !markdown.includes('Component omitted:'),
      `${file}: missing component serializer`,
    )
    for (const [tag, sources] of Object.entries(examples)) {
      if (!markdown.includes(`### ${sources[0]}\n`)) continue
      seen.add(tag)
      const component = readFileSync(new URL(sources[0], root), 'utf8')
      const localComponents = [
        ...component.matchAll(
          /<(DocsLab|StateInspector|CodePreview|EventTimeline|DocumentDiff)\b/g,
        ),
      ].map(([, name]) => `app/components/content/${name}.vue`)
      for (const source of new Set([...sources, ...localComponents])) {
        assert(
          markdown.includes(
            readFileSync(new URL(source, root), 'utf8').trimEnd(),
          ),
          `${file}: incomplete source ${source}`,
        )
      }
    }
  }
}
checkDirectory(raw.pathname)
assert.deepEqual(
  [...seen].sort(),
  Object.keys(examples).sort(),
  'Every public demo must have a rendered source example',
)
console.log(
  'Every board demo exports its current source and local dependencies.',
)
