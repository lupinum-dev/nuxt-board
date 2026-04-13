<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import DocsInsightNode from './DocsInsightNode.vue'

const engine = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'cross' }
})

const renderers: BoardRendererRegistry = {
  insight: DocsInsightNode
}

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'why', type: 'insight', x: 80, y: 80, width: 250, height: 160, data: { title: 'Use custom renderers', body: 'Render any domain object with your own Vue component.' }, zIndex: 1, locked: false, visible: true },
      { id: 'flow', type: 'text', x: 390, y: 130, width: 230, height: 120, data: { content: 'Mix defaults and custom renderers in one board.' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

function addInsight() {
  engine.createNode({
    type: 'insight',
    x: 160 + Math.round(Math.random() * 260),
    y: 80 + Math.round(Math.random() * 160),
    width: 250,
    height: 160,
    data: {
      title: 'Another renderer',
      body: 'Node data stays serializable while presentation stays fully custom.'
    }
  })
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(72, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="seed">
        Reset renderers
      </button>
      <button @click="addInsight">
        Add insight card
      </button>
      <button @click="engine.zoomToFit(72, false)">
        Focus board
      </button>
    </div>

    <BoardRoot
      :engine="engine"
      :renderers="renderers"
      style="height: 340px"
    />
  </div>
</template>
