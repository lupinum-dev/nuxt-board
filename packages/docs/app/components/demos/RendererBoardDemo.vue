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
  insight: DocsInsightNode,
  metric: DocsMetricNode,
}

function seed() {
  engine.importJSON(
    JSON.stringify({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'why',
          type: 'insight',
          x: 80,
          y: 80,
          width: 250,
          height: 160,
          data: {
            title: 'Use custom renderers',
            body: 'Render any domain object with your own Vue component.',
          },
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'metric',
          type: 'metric',
          x: 390,
          y: 90,
          width: 230,
          height: 160,
          data: {
            label: 'Adoption',
            value: '83%',
            delta: '+12%',
            caption:
              'The renderer can look nothing like the default text card.',
          },
          zIndex: 2,
          locked: false,
          visible: true,
        },
        {
          id: 'flow',
          type: 'text',
          x: 660,
          y: 130,
          width: 230,
          height: 100,
          data: { content: 'Default text renderer\nmixed with custom ones' },
          zIndex: 3,
          locked: false,
          visible: true,
        },
      ],
      selection: [],
      interaction: { mode: 'idle' },
      snapGuides: [],
      nextZIndex: 4,
    }),
    'replace',
  )
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
      body: 'Node data stays serializable while presentation stays fully custom.',
    },
  })
}

function addMetric() {
  engine.createNode({
    type: 'metric',
    x: 180 + Math.round(Math.random() * 320),
    y: 90 + Math.round(Math.random() * 140),
    width: 230,
    height: 160,
    data: {
      label: 'Confidence',
      value: '91%',
      delta: '+4%',
      caption:
        'Different node types can have their own layout and visual language.',
    },
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
