<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'
import {
  connectionPlugin,
  BoardConnectionLayer,
} from '@lupinum/board-connections'

const engine = createBoardEngine({
  grid: { size: 18, majorEvery: 6, snap: true, pattern: 'line' },
  extensions: [connectionPlugin()],
})

const payload = ref('')
const formatMode = ref<'pretty' | 'compact'>('pretty')
const SOURCE_ID = asNodeId('source')
const TARGET_ID = asNodeId('target')

function exportDocument() {
  const raw = engine.exportJSON()
  if (formatMode.value === 'compact') {
    return JSON.stringify(JSON.parse(raw))
  }
  return JSON.stringify(JSON.parse(raw), null, 2)
}

function seed() {
  engine.importJSON(
    JSON.stringify(
      createDemoDocument({
        camera: { x: 0, y: 0, z: 1 },
        grid: engine.getGridSettings(),
        selection: [],
        nextZIndex: 3,
        nodes: [
          {
            id: SOURCE_ID,
            type: 'text',
            x: 80,
            y: 110,
            width: 220,
            height: 100,
            text: 'Export me\nto JSON Canvas',
            zIndex: 1,
            locked: false,
            visible: true,
          },
          {
            id: TARGET_ID,
            type: 'text',
            x: 420,
            y: 110,
            width: 220,
            height: 100,
            text: 'Edit the JSON\nthen import back',
            zIndex: 2,
            locked: false,
            visible: true,
          },
        ],
      }),
    ),
    'replace',
  )
  for (const edge of engine.ext.connections.getEdges()) {
    engine.ext.connections.deleteEdge(edge.id)
  }
  engine.ext.connections.createEdge({
    from: SOURCE_ID,
    to: TARGET_ID,
    label: 'json-canvas',
    data: {},
  })
  payload.value = exportDocument()
}

function exportBoard() {
  payload.value = exportDocument()
}

function setFormatMode(nextMode: 'pretty' | 'compact') {
  formatMode.value = nextMode
  exportBoard()
}

function importBoard() {
  if (!payload.value.trim()) return
  engine.importJSON(payload.value, 'replace')
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
      <button class="demo-primary" @click="exportBoard">
        Export JSON Canvas
      </button>
      <button @click="importBoard">Import payload</button>
      <span class="demo-toggle-group">
        <button
          :class="{ active: formatMode === 'pretty' }"
          @click="setFormatMode('pretty')"
        >
          Pretty
        </button>
        <button
          :class="{ active: formatMode === 'compact' }"
          @click="setFormatMode('compact')"
        >
          Compact
        </button>
      </span>
    </div>

    <div class="grid gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <BoardRoot :engine="engine" style="height: 360px">
        <BoardConnectionLayer />
      </BoardRoot>
      <textarea
        v-model="payload"
        class="min-h-[360px] resize-none border-0 border-l border-default bg-inverted p-4 font-mono text-xs leading-6 text-primary outline-none"
        spellcheck="false"
      />
    </div>
  </div>
</template>
