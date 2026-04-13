<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const snapOn = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'line' }
})

const snapOff = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: false, pattern: 'line' }
})

function seed(engine: ReturnType<typeof createBoardEngine>, title: string) {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'source', type: 'text', x: 70, y: 70, width: 220, height: 110, data: { content: `${title}\nDrag this card` }, zIndex: 1, locked: false, visible: true },
      { id: 'target', type: 'text', x: 360, y: 190, width: 220, height: 110, data: { content: 'Watch how alignment feels' }, zIndex: 2, locked: false, visible: true }
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
      <button @click="reset">
        Reset comparison
      </button>
      <span class="demo-toolbar-note">Drag the same card on both boards. The left board locks to intersections, the right one stays freeform.</span>
    </div>

    <div class="grid gap-4 p-4 md:grid-cols-2">
      <div class="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white/80 shadow-sm">
        <div class="border-b border-slate-200/80 px-4 py-3">
          <p class="text-sm font-semibold text-slate-900">
            Snap on
          </p>
          <p class="text-xs text-slate-500">
            <code>grid.snap = true</code>
          </p>
        </div>
        <BoardRoot :engine="snapOn" style="height: 260px" />
      </div>

      <div class="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white/80 shadow-sm">
        <div class="border-b border-slate-200/80 px-4 py-3">
          <p class="text-sm font-semibold text-slate-900">
            Snap off
          </p>
          <p class="text-xs text-slate-500">
            <code>grid.snap = false</code>
          </p>
        </div>
        <BoardRoot :engine="snapOff" style="height: 260px" />
      </div>
    </div>
  </div>
</template>
