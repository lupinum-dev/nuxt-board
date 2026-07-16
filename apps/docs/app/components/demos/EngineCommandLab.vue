<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const CARD_ID = asNodeId('review-card')
const engine = createBoardEngine({ grid: { size: 20, snap: true } })
const revision = ref(0)
const events = ref<{ label: string; detail?: string; tone?: 'success' }[]>([])
const before = ref<Record<string, unknown>>({})
const after = ref<Record<string, unknown>>({})
const disposers: (() => void)[] = []

function nodeSummary() {
  const node = engine.getState().nodes.get(CARD_ID)
  return node
    ? { id: node.id, text: node.text, x: node.x, y: node.y, color: node.color }
    : { id: CARD_ID, deleted: true }
}

const state = computed(() => {
  void revision.value
  return {
    nodes: engine.getState().nodes.size,
    selection: engine.getSelection(),
    card: nodeSummary(),
  }
})

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      selection: [CARD_ID],
      nextZIndex: 3,
      nodes: [
        {
          id: CARD_ID,
          type: 'text',
          x: 90,
          y: 80,
          width: 240,
          height: 120,
          text: 'Review onboarding',
          color: '5',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: asNodeId('release-card'),
          type: 'text',
          x: 400,
          y: 180,
          width: 240,
          height: 120,
          text: 'Prepare release notes',
          color: '4',
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
    }),
    { mode: 'replace' },
  )
  events.value = []
  before.value = nodeSummary()
  after.value = nodeSummary()
  revision.value++
}

function rename() {
  before.value = nodeSummary()
  events.value = []
  engine.updateNode(CARD_ID, {
    text: 'Review onboarding · approved',
    color: '4',
  })
  after.value = nodeSummary()
  revision.value++
}

function move() {
  before.value = nodeSummary()
  events.value = []
  engine.moveNode(CARD_ID, 80, 40)
  after.value = nodeSummary()
  revision.value++
}

onMounted(async () => {
  disposers.push(
    engine.on('command:before', (name) =>
      events.value.push({ label: 'command:before', detail: name }),
    ),
    engine.on('node:updated', (node) =>
      events.value.push({ label: 'node:updated', detail: node.id }),
    ),
    engine.on('command:after', (name) =>
      events.value.push({
        label: 'command:after',
        detail: name,
        tone: 'success',
      }),
    ),
  )
  seed()
  await engine.zoomToFit(64, false)
})

onBeforeUnmount(() => disposers.forEach((dispose) => dispose()))
</script>

<template>
  <DocsLab
    title="Command inspector"
    description="Run one command and inspect the state change and publication order."
    instructions="Rename or move the selected card. The command commits before public events appear."
  >
    <template #controls>
      <button type="button" @click="seed">Reset</button>
      <button type="button" data-primary="true" @click="rename">
        Rename card
      </button>
      <button type="button" @click="move">Move card</button>
    </template>
    <BoardRoot :engine="engine" style="height: 360px" />
    <template #inspect>
      <StateInspector title="Engine state" :value="state" />
    </template>
    <template #timeline>
      <EventTimeline :entries="events" />
      <DocumentDiff :before="before" :after="after" />
    </template>
    <template #code>
      <CodePreview
        code="engine.updateNode(card.id, {\n  text: 'Review onboarding · approved',\n  color: '4',\n})"
      />
    </template>
  </DocsLab>
</template>
