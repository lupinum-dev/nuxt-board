<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine, createDemoDocument } from '#imports'

// The generated #imports entry verifies the helpers are registered by nuxt-board.
const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
})

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'nuxt',
          type: 'text',
          x: 100,
          y: 100,
          width: 240,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'board',
          type: 'text',
          x: 420,
          y: 180,
          width: 240,
          height: 100,
          text: 'Node',
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
      selection: [],
      nextZIndex: 3,
    }),
    { mode: 'replace' },
  )
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
      <button
        class="demo-primary"
        @click="
          engine.createNode({
            type: 'text',
            x: 260,
            y: 80,
            width: 220,
            height: 100,
            text: 'Node',
          })
        "
      >
        Add node
      </button>
      <button @click="engine.zoomToFit(84, false)">Zoom to fit</button>
    </div>

    <BoardRoot :engine="engine" style="height: 320px" />
  </div>
</template>
