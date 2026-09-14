import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

export const demoFiles = {
  stateInspectorSource: 'app/components/content/StateInspector.vue',
  codePreviewSource: 'app/components/content/CodePreview.vue',
  eventTimelineSource: 'app/components/content/EventTimeline.vue',
  documentDiffSource: 'app/components/content/DocumentDiff.vue',

  demoDocumentSource: 'app/utils/demoDocument.ts',
  docsLabSource: 'app/components/content/DocsLab.vue',
  basicBoardDemoSource: 'app/components/demos/BasicBoardDemo.vue',
  connectionsBoardDemoSource: 'app/components/demos/ConnectionsBoardDemo.vue',
  documentSessionLabSource: 'app/components/demos/DocumentSessionLab.vue',
  engineCommandLabSource: 'app/components/demos/EngineCommandLab.vue',
  eventLoggerSource: 'app/components/demos/EventLogger.vue',
  failedTransactionLabSource: 'app/components/demos/FailedTransactionLab.vue',
  interactionStateVizSource: 'app/components/demos/InteractionStateViz.vue',
  jsonImportExportDemoSource: 'app/components/demos/JsonImportExportDemo.vue',
  mindMapDemoSource: 'app/components/demos/MindMapDemo.vue',
  nuxtAutoImportsDemoSource: 'app/components/demos/NuxtAutoImportsDemo.vue',
  persistenceLabSource: 'app/components/demos/PersistenceLab.vue',
  readOnlyToggleDemoSource: 'app/components/demos/ReadOnlyToggleDemo.vue',
  rendererBoardDemoSource: 'app/components/demos/RendererBoardDemo.vue',
  rendererLabSource: 'app/components/demos/RendererLab.vue',
  themePlaygroundSource: 'app/components/demos/ThemePlayground.vue',
  workflowRendererDemoSource: 'app/components/demos/WorkflowRendererDemo.vue',
  labTaskNodeSource: 'app/components/demos/LabTaskNode.vue',
  docsInsightNodeSource: 'app/components/demos/DocsInsightNode.vue',
  docsMetricNodeSource: 'app/components/demos/DocsMetricNode.vue',
  mindMapTopicNodeSource: 'app/components/demos/MindMapTopicNode.vue',
  workflowStepNodeSource: 'app/components/demos/WorkflowStepNode.vue',
} as const

export function demoSourceModule(): string {
  const sources = Object.fromEntries(
    Object.entries(demoFiles).map(([name, file]) => [
      name,
      readFileSync(new URL(file, import.meta.url), 'utf8'),
    ]),
  )
  // Encode literal source so Nitro cannot rewrite import.meta or process.env inside examples.
  const encoded = Buffer.from(JSON.stringify(sources)).toString('base64')
  return `import { Buffer } from 'node:buffer'; export default JSON.parse(Buffer.from('${encoded}', 'base64').toString('utf8'))`
}
