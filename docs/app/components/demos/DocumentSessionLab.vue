<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const NODE_ID = asNodeId('session-card')
const engine = createBoardEngine({ grid: { size: 20, snap: false } })
const revision = ref(0)
const mode = ref('idle')
const disposers: (() => void)[] = []

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      selection: [NODE_ID],
      nextZIndex: 2,
      nodes: [
        {
          id: NODE_ID,
          type: 'text',
          x: 120,
          y: 100,
          width: 250,
          height: 120,
          text: 'Drag me, then release or press Escape',
          color: '6',
          zIndex: 1,
          locked: false,
          visible: true,
        },
      ],
    }),
    { mode: 'replace' },
  )
  revision.value++
}

const effective = computed(() => {
  void revision.value
  const node = engine.getState().nodes.get(NODE_ID)
  return node ? { x: node.x, y: node.y } : null
})

const committed = computed(() => {
  void revision.value
  const node = engine
    .exportDocument()
    .nodes.find((candidate) => candidate.id === NODE_ID)
  return node ? { x: node.x, y: node.y } : null
})

const comparison = computed(() => ({
  interaction: mode.value,
  effective: effective.value,
  exportedDocument: committed.value,
  differsDuringGesture:
    effective.value?.x !== committed.value?.x ||
    effective.value?.y !== committed.value?.y,
}))

onMounted(async () => {
  disposers.push(
    engine.$nodes.subscribe(() => revision.value++),
    engine.$interaction.subscribe((interaction) => {
      mode.value = interaction.mode
      revision.value++
    }),
  )
  seed()
  await engine.zoomToFit(80, false)
})

onBeforeUnmount(() => disposers.forEach((dispose) => dispose()))
</script>

<template>
  <DocsLab
    title="Document and session state"
    description="Effective geometry can move without changing the exported document."
    instructions="Drag the card slowly. While the pointer is down, compare effective and exported coordinates. Release to commit or press Escape to cancel."
  >
    <template #controls>
      <button type="button" @click="seed">Reset</button>
    </template>
    <BoardRoot :engine="engine" style="height: 360px" />
    <template #inspect>
      <StateInspector title="Live comparison" :value="comparison" />
    </template>
    <template #code>
      <CodePreview
        code="// Rendering reads effective runtime state\nengine.$nodes.subscribe(render)\n\n// Persistence reads committed document state\nconst document = engine.exportDocument()"
      />
    </template>
  </DocsLab>
</template>
