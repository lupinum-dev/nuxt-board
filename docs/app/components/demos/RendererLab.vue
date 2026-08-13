<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import { createDemoDocument } from '../../utils/demoDocument'
import LabTaskNode from './LabTaskNode.vue'

const NODE_ID = asNodeId('renderer-card')
const engine = createBoardEngine()
const custom = ref(false)
const revision = ref(0)
const renderers = computed<BoardRendererRegistry>(() =>
  custom.value ? { text: LabTaskNode } : {},
)

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
          x: 150,
          y: 90,
          width: 280,
          height: 150,
          text: 'Approve documentation structure',
          color: '5',
          zIndex: 1,
          locked: false,
          visible: true,
        },
      ],
    }),
    { mode: 'replace' },
  )
  revision.value += 1
}

const record = computed(() => {
  void revision.value
  const node = engine.getState().nodes.get(NODE_ID)
  return node
    ? { id: node.id, type: node.type, text: node.text, color: node.color }
    : null
})

onMounted(async () => {
  seed()
  await engine.zoomToFit(90, false)
})
</script>

<template>
  <DocsLab
    title="Renderer laboratory"
    description="Presentation can change without creating another node schema."
    instructions="Switch renderers and compare the card with the canonical record. The stored node does not change."
  >
    <template #controls>
      <button type="button" :data-primary="!custom" @click="custom = false">
        Default
      </button>
      <button type="button" :data-primary="custom" @click="custom = true">
        Task card
      </button>
    </template>
    <BoardRoot :engine="engine" :renderers="renderers" style="height: 340px" />
    <template #inspect>
      <StateInspector title="Canonical node record" :value="record" />
    </template>
    <template #code>
      <CodePreview
        :code="`const renderers: BoardRendererRegistry = {\n  text: TaskCard,\n}\n\n<BoardRoot :engine=&quot;engine&quot; :renderers=&quot;renderers&quot; />`"
      />
    </template>
  </DocsLab>
</template>
