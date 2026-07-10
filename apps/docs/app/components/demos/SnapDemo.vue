<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine({
  grid: {
    size: 24,
    majorEvery: 4,
    snap: true,
    edgeSnap: true,
    pattern: 'line',
  },
})

const gridSnap = ref(true)
const edgeSnap = ref(true)

watch(gridSnap, (v) => engine.updateGridSettings({ snap: v }))
watch(edgeSnap, (v) => engine.updateGridSettings({ edgeSnap: v }))

function seed() {
  engine.importDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'a',
          type: 'text',
          x: 70,
          y: 70,
          width: 210,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'b',
          type: 'text',
          x: 340,
          y: 180,
          width: 210,
          height: 100,
          text: 'Node',
          zIndex: 2,
          locked: false,
          visible: true,
        },
        {
          id: 'c',
          type: 'text',
          x: 200,
          y: 320,
          width: 210,
          height: 100,
          text: 'Node',
          zIndex: 3,
          locked: false,
          visible: true,
        },
      ],
      selection: [],
      nextZIndex: 4,
    }),
    'replace',
  )
}

async function reset() {
  seed()
  await engine.zoomToFit(52, false)
}

onMounted(reset)
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">Reset</button>
      <label class="demo-toggle">
        <input v-model="gridSnap" type="checkbox" />
        <span>Grid snap</span>
      </label>
      <label class="demo-toggle">
        <input v-model="edgeSnap" type="checkbox" />
        <span>Edge snap</span>
      </label>
      <span class="demo-toolbar-note"
        >Toggle each snap mode independently. Hold <kbd>Space</kbd> while
        dragging to bypass both.</span
      >
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_220px]">
      <BoardRoot :engine="engine" style="height: 360px" />

      <div
        class="border-t border-default bg-elevated p-4 lg:border-t-0 lg:border-l"
      >
        <p
          class="text-xs font-semibold uppercase tracking-[0.28em] text-dimmed"
        >
          Active modes
        </p>
        <div class="mt-3 space-y-2">
          <div
            class="inline-flex rounded-full px-3 py-1.5 text-sm font-semibold"
            :class="
              gridSnap
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-zinc-100 text-zinc-400'
            "
          >
            Grid snap {{ gridSnap ? 'on' : 'off' }}
          </div>
          <div
            class="inline-flex rounded-full px-3 py-1.5 text-sm font-semibold"
            :class="
              edgeSnap
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-zinc-100 text-zinc-400'
            "
          >
            Edge snap {{ edgeSnap ? 'on' : 'off' }}
          </div>
        </div>
        <div class="mt-5 rounded-md border border-default bg-default p-3">
          <p class="text-xs text-dimmed leading-relaxed">
            <strong>Grid snap</strong> aligns to grid intersections.<br />
            <strong>Edge snap</strong> shows alignment guides when node edges
            line up.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
