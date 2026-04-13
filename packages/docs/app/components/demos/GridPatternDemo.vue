<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const demos = [
  { label: 'Line', pattern: 'line' as const },
  { label: 'Dot', pattern: 'dot' as const },
  { label: 'Cross', pattern: 'cross' as const },
  { label: 'None', pattern: 'none' as const }
].map((entry) => ({
  ...entry,
  engine: createBoardEngine({
    grid: { size: 20, majorEvery: 5, snap: true, pattern: entry.pattern }
  })
}))

function seedOne(pattern: 'line' | 'dot' | 'cross' | 'none', engine: ReturnType<typeof createBoardEngine>) {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: { ...engine.getGridSettings(), pattern },
    nodes: [
      { id: 'alpha', type: 'text', x: 70, y: 70, width: 200, height: 100, data: { content: `${pattern}\nDrag me` }, zIndex: 1, locked: false, visible: true },
      { id: 'beta', type: 'text', x: 330, y: 160, width: 200, height: 100, data: { content: 'Same nodes\ndifferent pattern' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

async function reset() {
  for (const demo of demos) {
    seedOne(demo.pattern, demo.engine)
  }
  await Promise.all(demos.map(demo => demo.engine.zoomToFit(52, false)))
}

onMounted(reset)
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">
        Reset all
      </button>
      <span class="demo-toolbar-note">Each board has the same nodes and snap settings. Only the pattern changes.</span>
    </div>

    <div class="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="demo in demos"
        :key="demo.pattern"
        class="overflow-hidden rounded-md border border-default bg-elevated shadow-sm"
      >
        <div class="border-b border-default px-4 py-3">
          <p class="text-sm font-semibold text-highlighted">
            {{ demo.label }}
          </p>
          <p class="text-xs text-dimmed">
            <code>{{ demo.pattern }}</code>
          </p>
        </div>
        <BoardRoot
          :engine="demo.engine"
          style="height: 220px"
        />
      </div>
    </div>
  </div>
</template>
