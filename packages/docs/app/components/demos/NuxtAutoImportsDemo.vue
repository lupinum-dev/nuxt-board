<script setup lang="ts">
import { onMounted } from 'vue'

// Intentionally no imports from @lupinum/* here.
// This component exercises the auto-imports provided by @lupinum/nuxt-board.
const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' }
})

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'nuxt', type: 'text', x: 100, y: 100, width: 240, height: 120, data: { content: 'Nuxt module\nNo manual imports required' }, zIndex: 1, locked: false, visible: true },
      { id: 'board', type: 'text', x: 420, y: 180, width: 240, height: 120, data: { content: 'BoardRoot\nBoard composables\ncreateBoardEngine' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(84, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="seed">
        Reset demo
      </button>
      <button @click="engine.createNode({ type: 'text', x: 260, y: 80, width: 220, height: 110, data: { content: 'Auto-imported from Nuxt' } })">
        Add node
      </button>
      <button @click="engine.zoomToFit(84, false)">
        Fit view
      </button>
    </div>

    <BoardRoot
      :engine="engine"
      style="height: 320px"
    />
  </div>
</template>
