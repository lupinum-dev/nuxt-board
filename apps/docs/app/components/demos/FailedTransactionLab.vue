<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'
import { createDemoDocument } from '../../utils/demoDocument'

const CARD_ID = asNodeId('atomic-card')
const engine = createBoardEngine({ plugins: [historyPlugin()] })
const status = ref('Ready')
const events = ref<
  { label: string; detail?: string; tone?: 'success' | 'danger' }[]
>([])
const before = ref<Record<string, unknown>>({})
const after = ref<Record<string, unknown>>({})
const revision = ref(0)
const disposers: (() => void)[] = []

function summary() {
  const node = engine.getState().nodes.get(CARD_ID)
  return { text: node?.text, x: node?.x, nodes: engine.getState().nodes.size }
}

const inspector = computed(() => {
  void revision.value
  return {
    status: status.value,
    document: summary(),
    canUndo: engine.plugins.history.canUndo(),
    publishedEvents: events.value.length,
  }
})

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      selection: [CARD_ID],
      nextZIndex: 2,
      nodes: [
        {
          id: CARD_ID,
          type: 'text',
          x: 150,
          y: 110,
          width: 260,
          height: 120,
          text: 'Committed document',
          zIndex: 1,
          locked: false,
          visible: true,
        },
      ],
    }),
    { mode: 'replace' },
  )
  engine.plugins.history.clear()
  status.value = 'Ready'
  events.value = []
  before.value = summary()
  after.value = summary()
  revision.value++
}

function runSuccess() {
  events.value = []
  before.value = summary()
  engine.batch(() => {
    engine.updateNode(CARD_ID, { text: 'Successful batch' })
    engine.moveNode(CARD_ID, 80, 40)
  })
  after.value = summary()
  status.value = 'Committed once'
  revision.value++
}

function runFailure() {
  events.value = []
  before.value = summary()
  try {
    engine.batch(() => {
      engine.updateNode(CARD_ID, { text: 'This must not publish' })
      engine.createNode({
        id: CARD_ID,
        type: 'text',
        x: 0,
        y: 0,
        text: 'Duplicate',
      })
    })
  } catch (error) {
    status.value = error instanceof Error ? error.name : 'Rejected'
  }
  after.value = summary()
  revision.value++
}

onMounted(async () => {
  disposers.push(
    engine.on('node:updated', () =>
      events.value.push({ label: 'node:updated' }),
    ),
    engine.on('command:after', (name) =>
      events.value.push({
        label: 'command:after',
        detail: name,
        tone: 'success',
      }),
    ),
    engine.on('validation:failed', () =>
      events.value.push({ label: 'validation:failed', tone: 'danger' }),
    ),
  )
  seed()
  await engine.zoomToFit(80, false)
})

onBeforeUnmount(() => disposers.forEach((dispose) => dispose()))
</script>

<template>
  <DocsLab
    title="Atomic transaction"
    description="A failed batch restores the previous roots and discards queued publications."
    instructions="Run the successful batch, reset, then run the duplicate-ID batch. The failed candidate never becomes observable."
  >
    <template #controls>
      <button type="button" @click="seed">Reset</button>
      <button type="button" data-primary="true" @click="runSuccess">
        Run valid batch
      </button>
      <button type="button" @click="runFailure">Run failing batch</button>
    </template>
    <BoardRoot :engine="engine" style="height: 340px" />
    <template #inspect>
      <StateInspector title="Transaction result" :value="inspector" />
    </template>
    <template #timeline>
      <EventTimeline :entries="events" />
      <DocumentDiff :before="before" :after="after" />
    </template>
    <template #code>
      <CodePreview
        code="engine.batch(() => {\n  engine.updateNode(card.id, patch)\n  engine.createNode({ id: card.id, ...input }) // duplicate\n})\n// Throws. State and queued publications are restored."
      />
    </template>
  </DocsLab>
</template>
