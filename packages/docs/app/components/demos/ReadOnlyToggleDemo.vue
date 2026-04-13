<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' }
})

const isReadOnly = ref(true)
const blockedCount = ref(0)
let unsubscribeReadOnly: (() => void) | null = null

const blockedCommands = new Set([
  'createNode',
  'updateNode',
  'deleteNode',
  'moveNode',
  'resizeNode',
  'deleteSelected',
  'duplicateNodes',
  'translateSelectedNodes',
  'bringToFront',
  'sendToBack',
  'lockNode',
  'unlockNode',
  'commitTextEdit',
  'copySelected',
  'pasteClipboard'
])

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: 0, y: 0, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'ro-a', type: 'text', x: 80, y: 90, width: 220, height: 120, data: { content: 'Toggle read-only mode' }, zIndex: 1, locked: false, visible: true },
      { id: 'ro-b', type: 'text', x: 380, y: 190, width: 220, height: 120, data: { content: 'Pan and zoom always work' }, zIndex: 2, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 3
  }), 'replace')
}

function applyReadOnly() {
  unsubscribeReadOnly?.()
  unsubscribeReadOnly = null

  if (!isReadOnly.value) {
    return
  }

  unsubscribeReadOnly = engine.addMiddleware((name, _args, next) => {
    if (blockedCommands.has(name)) {
      blockedCount.value += 1
      return
    }
    next()
  })
}

watch(isReadOnly, applyReadOnly)

onMounted(async () => {
  seed()
  applyReadOnly()
  await engine.zoomToFit(60, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="seed">
        Reset board
      </button>
      <button @click="isReadOnly = !isReadOnly">
        {{ isReadOnly ? 'Switch to edit mode' : 'Switch to read-only' }}
      </button>
      <span class="demo-toolbar-note">
        {{ isReadOnly ? 'Mutations are blocked. Try dragging, editing, or deleting.' : 'Mutations are allowed again.' }}
      </span>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
      <BoardRoot :engine="engine" style="height: 360px" />

      <div class="border-t border-slate-200/80 bg-white/80 p-4 lg:border-t-0 lg:border-l">
        <div class="inline-flex rounded-full px-3 py-2 text-sm font-semibold" :class="isReadOnly ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'">
          {{ isReadOnly ? 'Read-only' : 'Editable' }}
        </div>
        <div class="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Blocked attempts
          </p>
          <p class="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {{ blockedCount }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
