<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const snapOn = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'line' }
})

const snapOff = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: false, pattern: 'line' }
})

function seed(engine: ReturnType<typeof createBoardEngine>, label: string) {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'source', type: 'text', x: 70, y: 70, width: 210, height: 100, data: { content: `${label}\nDrag me around` }, zIndex: 1, locked: false, visible: true },
      { id: 'target', type: 'text', x: 340, y: 180, width: 210, height: 100, data: { content: 'Line me up\nwith this card' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

async function reset() {
  seed(snapOn, 'Snap on')
  seed(snapOff, 'Snap off')
  await Promise.all([snapOn.zoomToFit(52, false), snapOff.zoomToFit(52, false)])
}

onMounted(reset)
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">
        Reset
      </button>
      <span class="demo-toolbar-note">Drag a card on each board. The left snaps to grid intersections, the right stays freeform.</span>
    </div>

    <div class="grid gap-4 p-4 md:grid-cols-2">
      <div class="overflow-hidden rounded-md border border-default bg-elevated shadow-sm">
        <div class="border-b border-default px-4 py-3">
          <p class="text-sm font-semibold text-highlighted">
            Snap on
          </p>
          <p class="text-xs text-dimmed">
            <code>grid.snap = true</code>
          </p>
        </div>
        <BoardRoot :engine="snapOn" style="height: 260px" />
      </div>

      <div class="overflow-hidden rounded-md border border-default bg-elevated shadow-sm">
        <div class="border-b border-default px-4 py-3">
          <p class="text-sm font-semibold text-highlighted">
            Snap off
          </p>
          <p class="text-xs text-dimmed">
            <code>grid.snap = false</code>
          </p>
        </div>
        <BoardRoot :engine="snapOff" style="height: 260px" />
      </div>
    </div>
  </div>
</template>
