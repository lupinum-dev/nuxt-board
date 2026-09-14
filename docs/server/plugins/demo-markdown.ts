import { registerAgentMarkdownSerializers } from '@lupinum/ginko-content/agent-registry'
import { defineNitroPlugin } from 'nitropack/runtime'
import sources from '#demo-sources'

const setup =
  'Use the installation guide to register @lupinum/nuxt-board. These are the actual documentation demo files. Keep their paths under app/. The module auto-imports Board components; install the optional packages named in imports. For the local content components, use components: [{ path: "~/components/content", pathPrefix: false }, "~/components"] in nuxt.config.ts, as this site does, or import them explicitly. createDemoDocument is a local helper, not a package export. DocsLab and the inspector components provide presentation only.'

const examples: Record<string, [string, string][]> = {
  'basic-board-demo': [
    ['app/components/demos/BasicBoardDemo.vue', sources.basicBoardDemoSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'connections-board-demo': [
    [
      'app/components/demos/ConnectionsBoardDemo.vue',
      sources.connectionsBoardDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'document-session-lab': [
    [
      'app/components/demos/DocumentSessionLab.vue',
      sources.documentSessionLabSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/content/DocsLab.vue', sources.docsLabSource],
    ['app/components/content/StateInspector.vue', sources.stateInspectorSource],
    ['app/components/content/CodePreview.vue', sources.codePreviewSource],
  ],
  'engine-command-lab': [
    [
      'app/components/demos/EngineCommandLab.vue',
      sources.engineCommandLabSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/content/DocsLab.vue', sources.docsLabSource],
    ['app/components/content/StateInspector.vue', sources.stateInspectorSource],
    ['app/components/content/CodePreview.vue', sources.codePreviewSource],
    ['app/components/content/EventTimeline.vue', sources.eventTimelineSource],
    ['app/components/content/DocumentDiff.vue', sources.documentDiffSource],
  ],
  'event-logger': [
    ['app/components/demos/EventLogger.vue', sources.eventLoggerSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'failed-transaction-lab': [
    [
      'app/components/demos/FailedTransactionLab.vue',
      sources.failedTransactionLabSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/content/DocsLab.vue', sources.docsLabSource],
    ['app/components/content/StateInspector.vue', sources.stateInspectorSource],
    ['app/components/content/CodePreview.vue', sources.codePreviewSource],
    ['app/components/content/EventTimeline.vue', sources.eventTimelineSource],
    ['app/components/content/DocumentDiff.vue', sources.documentDiffSource],
  ],
  'interaction-state-viz': [
    [
      'app/components/demos/InteractionStateViz.vue',
      sources.interactionStateVizSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'json-import-export-demo': [
    [
      'app/components/demos/JsonImportExportDemo.vue',
      sources.jsonImportExportDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'mind-map-demo': [
    ['app/components/demos/MindMapDemo.vue', sources.mindMapDemoSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    [
      'app/components/demos/MindMapTopicNode.vue',
      sources.mindMapTopicNodeSource,
    ],
  ],
  'nuxt-auto-imports-demo': [
    [
      'app/components/demos/NuxtAutoImportsDemo.vue',
      sources.nuxtAutoImportsDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'persistence-lab': [
    ['app/components/demos/PersistenceLab.vue', sources.persistenceLabSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/content/DocsLab.vue', sources.docsLabSource],
    ['app/components/content/StateInspector.vue', sources.stateInspectorSource],
    ['app/components/content/CodePreview.vue', sources.codePreviewSource],
  ],
  'read-only-toggle-demo': [
    [
      'app/components/demos/ReadOnlyToggleDemo.vue',
      sources.readOnlyToggleDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'renderer-board-demo': [
    [
      'app/components/demos/RendererBoardDemo.vue',
      sources.rendererBoardDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/demos/DocsInsightNode.vue', sources.docsInsightNodeSource],
    ['app/components/demos/DocsMetricNode.vue', sources.docsMetricNodeSource],
  ],
  'renderer-lab': [
    ['app/components/demos/RendererLab.vue', sources.rendererLabSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    ['app/components/content/DocsLab.vue', sources.docsLabSource],
    ['app/components/demos/LabTaskNode.vue', sources.labTaskNodeSource],
    ['app/components/content/StateInspector.vue', sources.stateInspectorSource],
    ['app/components/content/CodePreview.vue', sources.codePreviewSource],
  ],
  'theme-playground': [
    ['app/components/demos/ThemePlayground.vue', sources.themePlaygroundSource],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
  ],
  'workflow-renderer-demo': [
    [
      'app/components/demos/WorkflowRendererDemo.vue',
      sources.workflowRendererDemoSource,
    ],
    ['app/utils/demoDocument.ts', sources.demoDocumentSource],
    [
      'app/components/demos/WorkflowStepNode.vue',
      sources.workflowStepNodeSource,
    ],
  ],
}

function sourceFile([path, source]: [string, string]): string {
  const language = path.endsWith('.vue') ? 'vue' : 'ts'
  return `### ${path}\n\n\`\`\`\`${language}\n${source.trimEnd()}\n\`\`\`\``
}

export default defineNitroPlugin(() => {
  for (const [tag, files] of Object.entries(examples)) {
    registerAgentMarkdownSerializers({
      [tag]: () =>
        ['## Live example source', setup, ...files.map(sourceFile)].join(
          '\n\n',
        ),
    })
  }
})
