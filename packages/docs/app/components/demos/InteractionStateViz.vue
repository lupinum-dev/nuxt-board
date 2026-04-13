<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'cross' }
})

const mode = ref(engine.$interaction.get().mode)
const selection = ref(engine.getSelection())
let unsubscribeInteraction: (() => void) | null = null
let unsubscribeSelection: (() => void) | null = null

const statusTone = computed(() => {
  if (mode.value === 'idle') return 'bg-slate-100 text-slate-700'
  if (mode.value.includes('drag') || mode.value.includes('resize')) return 'bg-sky-50 text-sky-700'
  if (mode.value.includes('pan')) return 'bg-amber-50 text-amber-700'
  return 'bg-emerald-50 text-emerald-700'
})

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'state-a', type: 'text', x: 70, y: 80, width: 220, height: 110, data: { content: 'Drag me' }, zIndex: 1, locked: false, visible: true },
      { id: 'state-b', type: 'text', x: 360, y: 180, width: 220, height: 110, data: { content: 'Box-select or pan' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

async function reset() {
  seed()
  selection.value = []
  await engine.zoomToFit(60, false)
}

onMounted(() => {
  unsubscribeInteraction = engine.$interaction.subscribe((interaction) => {
    mode.value = interaction.mode
  })
  unsubscribeSelection = engine.on('selection:change', (next) => {
    selection.value = next
  })
  void reset()
})

onBeforeUnmount(() => {
  unsubscribeInteraction?.()
  unsubscribeSelection?.()
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="reset">
        Reset board
      </button>
      <span class="demo-toolbar-note">Drag, resize, box-select, or pan to watch the interaction mode change live.</span>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
      <BoardRoot :engine="engine" style="height: 360px" />

      <div class="border-t border-slate-200/80 bg-white/80 p-4 lg:border-t-0 lg:border-l">
        <p class="text-sm font-semibold text-slate-900">
          Current interaction
        </p>
        <div class="mt-4 inline-flex rounded-full px-3 py-2 text-sm font-semibold" :class="statusTone">
          {{ mode }}
        </div>
        <div class="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Selection
          </p>
          <p class="mt-2 text-sm text-slate-700">
            {{ selection.length ? selection.join(', ') : 'Nothing selected yet.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
