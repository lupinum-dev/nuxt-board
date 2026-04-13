<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin, BoardConnectionLayer, type ConnectionRouting } from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import { BoardMinimap } from '@lupinum/board-minimap'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
  plugins: [historyPlugin(), connectionPlugin()]
})

const historyState = computed(() => engine.ext.history.getState())
const routing = ref<ConnectionRouting>('bezier')

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: -80, y: -40, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'input', type: 'text', x: 80, y: 150, width: 180, height: 96, data: { content: 'Input' }, zIndex: 1, locked: false, visible: true },
      { id: 'parse', type: 'text', x: 340, y: 80, width: 200, height: 96, data: { content: 'Parse' }, zIndex: 2, locked: false, visible: true },
      { id: 'score', type: 'text', x: 340, y: 240, width: 200, height: 96, data: { content: 'Score' }, zIndex: 3, locked: false, visible: true },
      { id: 'output', type: 'text', x: 650, y: 150, width: 180, height: 96, data: { content: 'Output' }, zIndex: 4, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 5
  }), 'replace')
  const connections = engine.ext.connections
  for (const edge of connections.getEdges()) {
    connections.deleteEdge(edge.id)
  }
  connections.createEdge({ from: 'input' as never, to: 'parse' as never, label: 'clean', data: {} })
  connections.createEdge({ from: 'input' as never, to: 'score' as never, label: 'rank', data: {} })
  connections.createEdge({ from: 'parse' as never, to: 'output' as never, label: 'emit', data: {} })
  connections.createEdge({ from: 'score' as never, to: 'output' as never, label: 'merge', data: {} })
}

function shuffle() {
  engine.updateNode('parse' as never, { x: 320 + Math.round(Math.random() * 70), y: 60 + Math.round(Math.random() * 60) })
  engine.updateNode('score' as never, { x: 320 + Math.round(Math.random() * 70), y: 220 + Math.round(Math.random() * 60) })
  engine.updateNode('output' as never, { x: 620 + Math.round(Math.random() * 80), y: 120 + Math.round(Math.random() * 80) })
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(84, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">
        Reset
      </button>
      <button @click="shuffle">
        Shuffle
      </button>
      <span class="demo-toggle-group">
        <button :class="{ active: routing === 'bezier' }" @click="routing = 'bezier'">Bezier</button>
        <button :class="{ active: routing === 'smooth-step' }" @click="routing = 'smooth-step'">Smooth</button>
        <button :class="{ active: routing === 'step' }" @click="routing = 'step'">Step</button>
        <button :class="{ active: routing === 'straight' }" @click="routing = 'straight'">Straight</button>
      </span>
      <button :disabled="!engine.ext.history.canUndo()" @click="engine.ext.history.undo()">
        Undo
      </button>
      <button :disabled="!engine.ext.history.canRedo()" @click="engine.ext.history.redo()">
        Redo
      </button>
      <span class="demo-history-badge ml-auto">{{ historyState.undoDepth }} undo / {{ historyState.redoDepth }} redo</span>
    </div>

    <div class="relative">
      <BoardRoot
        :engine="engine"
        style="height: 360px"
      >
        <BoardConnectionLayer :routing="routing" />
      </BoardRoot>
      <div class="absolute right-4 bottom-4 rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-lg backdrop-blur">
        <BoardMinimap
          :engine="engine"
          :width="180"
          :height="110"
        />
      </div>
    </div>
  </div>
</template>
