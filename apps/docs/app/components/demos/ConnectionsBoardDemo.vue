<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'
import {
  connectionsPlugin,
  BoardConnectionLayer,
  type ConnectionRouting,
} from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import { BoardMinimap } from '@lupinum/board-minimap'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
  plugins: [historyPlugin(), connectionsPlugin()],
})

const historyState = computed(() => engine.plugins.history.getState())
const routing = ref<ConnectionRouting>('bezier')
const INPUT_ID = asNodeId('input')
const PARSE_ID = asNodeId('parse')
const SCORE_ID = asNodeId('score')
const OUTPUT_ID = asNodeId('output')

function seed() {
  engine.importJSON(
    JSON.stringify(
      createDemoDocument({
        camera: { x: -80, y: -40, z: 1 },
        grid: engine.getGridSettings(),
        nodes: [
          {
            id: 'input',
            type: 'text',
            x: 80,
            y: 150,
            width: 180,
            height: 96,
            text: 'Node',
            zIndex: 1,
            locked: false,
            visible: true,
          },
          {
            id: 'parse',
            type: 'text',
            x: 340,
            y: 80,
            width: 200,
            height: 96,
            text: 'Node',
            zIndex: 2,
            locked: false,
            visible: true,
          },
          {
            id: 'score',
            type: 'text',
            x: 340,
            y: 240,
            width: 200,
            height: 96,
            text: 'Node',
            zIndex: 3,
            locked: false,
            visible: true,
          },
          {
            id: 'output',
            type: 'text',
            x: 650,
            y: 150,
            width: 180,
            height: 96,
            text: 'Node',
            zIndex: 4,
            locked: false,
            visible: true,
          },
        ],
        selection: [],
        nextZIndex: 5,
      }),
    ),
    'replace',
  )
  const connections = engine.plugins.connections
  for (const edge of connections.getEdges()) {
    connections.deleteEdge(edge.id)
  }
  connections.createEdge({
    from: INPUT_ID,
    to: PARSE_ID,
    label: 'clean',
    data: {},
  })
  connections.createEdge({
    from: INPUT_ID,
    to: SCORE_ID,
    label: 'rank',
    data: {},
  })
  connections.createEdge({
    from: PARSE_ID,
    to: OUTPUT_ID,
    label: 'emit',
    data: {},
  })
  connections.createEdge({
    from: SCORE_ID,
    to: OUTPUT_ID,
    label: 'merge',
    data: {},
  })
}

function shuffle() {
  engine.updateNode(PARSE_ID, {
    x: 320 + Math.round(Math.random() * 70),
    y: 60 + Math.round(Math.random() * 60),
  })
  engine.updateNode(SCORE_ID, {
    x: 320 + Math.round(Math.random() * 70),
    y: 220 + Math.round(Math.random() * 60),
  })
  engine.updateNode(OUTPUT_ID, {
    x: 620 + Math.round(Math.random() * 80),
    y: 120 + Math.round(Math.random() * 80),
  })
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(84, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">Reset</button>
      <button @click="shuffle">Shuffle</button>
      <span class="demo-toggle-group">
        <button
          :class="{ active: routing === 'bezier' }"
          @click="routing = 'bezier'"
        >
          Bezier
        </button>
        <button
          :class="{ active: routing === 'smooth-step' }"
          @click="routing = 'smooth-step'"
        >
          Smooth
        </button>
        <button
          :class="{ active: routing === 'step' }"
          @click="routing = 'step'"
        >
          Step
        </button>
        <button
          :class="{ active: routing === 'straight' }"
          @click="routing = 'straight'"
        >
          Straight
        </button>
      </span>
      <button
        :disabled="!engine.plugins.history.canUndo()"
        @click="engine.plugins.history.undo()"
      >
        Undo
      </button>
      <button
        :disabled="!engine.plugins.history.canRedo()"
        @click="engine.plugins.history.redo()"
      >
        Redo
      </button>
      <span class="demo-history-badge ml-auto"
        >{{ historyState.undoDepth }} undo /
        {{ historyState.redoDepth }} redo</span
      >
    </div>

    <div class="relative">
      <BoardRoot :engine="engine" style="height: 360px">
        <BoardConnectionLayer :routing="routing" />
      </BoardRoot>
      <div
        class="absolute right-4 bottom-4 rounded-md border border-default bg-elevated/90 p-2 shadow-lg backdrop-blur"
      >
        <BoardMinimap :engine="engine" :width="180" :height="110" />
      </div>
    </div>
  </div>
</template>
