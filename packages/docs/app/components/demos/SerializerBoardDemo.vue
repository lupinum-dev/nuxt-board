<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { connectionPlugin, BoardConnectionLayer } from '@lupinum/board-connections'
import { jsonCanvasSerializer } from '@lupinum/board-serializer'

const engine = createBoardEngine({
  grid: { size: 18, majorEvery: 6, snap: true, pattern: 'line' },
  plugins: [connectionPlugin()]
})

const payload = ref('')
const formatMode = ref<'pretty' | 'compact'>('pretty')

function serializeBoard() {
  const raw = jsonCanvasSerializer.export(engine)
  if (formatMode.value === 'compact') {
    return JSON.stringify(JSON.parse(raw))
  }
  return JSON.stringify(JSON.parse(raw), null, 2)
}

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'source', type: 'text', x: 80, y: 110, width: 220, height: 120, data: { content: 'Serialize me' }, zIndex: 1, locked: false, visible: true },
      { id: 'target', type: 'text', x: 420, y: 110, width: 220, height: 120, data: { content: 'Round-trip me' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
  for (const edge of engine.ext.connections.getEdges()) {
    engine.ext.connections.deleteEdge(edge.id)
  }
  engine.ext.connections.createEdge({ from: 'source' as never, to: 'target' as never, label: 'json-canvas', data: {} })
  payload.value = serializeBoard()
}

function exportBoard() {
  payload.value = serializeBoard()
}

function importBoard() {
  if (!payload.value.trim()) return
  const document = jsonCanvasSerializer.parse(payload.value)
  jsonCanvasSerializer.hydrateEngine(engine, document, 'replace')
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
        Reset board
      </button>
      <button @click="exportBoard">
        Export JSON Canvas
      </button>
      <button @click="importBoard">
        Import payload
      </button>
      <button :class="{ 'bg-teal-100': formatMode === 'pretty' }" @click="formatMode = 'pretty'; exportBoard()">
        Pretty JSON
      </button>
      <button :class="{ 'bg-teal-100': formatMode === 'compact' }" @click="formatMode = 'compact'; exportBoard()">
        Compact JSON
      </button>
    </div>

    <div class="grid gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <BoardRoot
        :engine="engine"
        style="height: 360px"
      >
        <BoardConnectionLayer />
      </BoardRoot>
      <textarea
        v-model="payload"
        class="min-h-[360px] resize-none border-0 border-l border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-teal-100 outline-none"
        spellcheck="false"
      />
    </div>
  </div>
</template>
