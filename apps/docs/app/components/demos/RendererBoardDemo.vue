<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import DocsInsightNode from './DocsInsightNode.vue'
import DocsMetricNode from './DocsMetricNode.vue'

const engine = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'cross' },
})

const renderers: BoardRendererRegistry = {
  text: DocsInsightNode,
  group: DocsMetricNode,
}

function seed() {
  engine.importJSON(
    JSON.stringify({
      nodes: [
        {
          id: 'why',
          type: 'text',
          x: 80,
          y: 80,
          width: 250,
          height: 160,
          text: 'Why custom renderers\nSwap the default card view for a Vue component while keeping JSON Canvas node data explicit.',
        },
        {
          id: 'metric',
          type: 'group',
          x: 390,
          y: 90,
          width: 230,
          height: 160,
          label:
            'Adoption\n83%\n+12%\nThe renderer can look nothing like the default text card.',
        },
        {
          id: 'flow',
          type: 'text',
          x: 660,
          y: 130,
          width: 230,
          height: 100,
          text: 'Default JSON Canvas\nRenderers are keyed by real node type.',
        },
      ],
      'x-vue-board': {
        camera: { x: 0, y: 0, z: 1 },
        grid: engine.getGridSettings(),
        selection: [],
        nextZIndex: 4,
        nodes: {
          why: { zIndex: 1, locked: false, visible: true },
          metric: { zIndex: 2, locked: false, visible: true },
          flow: { zIndex: 3, locked: false, visible: true },
        },
      },
    }),
    'replace',
  )
}

function addInsight() {
  engine.createNode({
    type: 'text',
    x: 160 + Math.round(Math.random() * 260),
    y: 80 + Math.round(Math.random() * 160),
    width: 250,
    height: 160,
    text: 'New insight\nUse a text node with a renderer registered for the JSON Canvas text type.',
  })
}

function addMetric() {
  engine.createNode({
    type: 'group',
    x: 180 + Math.round(Math.random() * 320),
    y: 90 + Math.round(Math.random() * 140),
    width: 230,
    height: 160,
    label:
      'Confidence\n91%\n+4%\nDifferent JSON Canvas node types can have their own layout.',
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
      <button class="demo-danger" @click="seed">Reset</button>
      <button class="demo-primary" @click="addInsight">Add insight</button>
      <button @click="addMetric">Add metric</button>
      <button @click="engine.zoomToFit(72, false)">Zoom to fit</button>
    </div>

    <BoardRoot :engine="engine" :renderers="renderers" style="height: 340px" />
  </div>
</template>
