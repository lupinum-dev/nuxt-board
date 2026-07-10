<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'cross' },
})

const frame = ref<HTMLElement | null>(null)
const lastShortcut = ref('Click the board, then try a shortcut.')
const history = ref<string[]>([])

const shortcuts = new Map<string, string>([
  ['meta+a', 'Select all'],
  ['ctrl+a', 'Select all'],
  ['escape', 'Clear selection'],
  ['delete', 'Delete selected nodes'],
  ['backspace', 'Delete selected nodes'],
  ['meta+z', 'Undo'],
  ['ctrl+z', 'Undo'],
  ['meta+shift+z', 'Redo'],
  ['ctrl+shift+z', 'Redo'],
  ['meta+y', 'Redo'],
  ['ctrl+y', 'Redo'],
  ['meta+0', 'Zoom to 100%'],
  ['ctrl+0', 'Zoom to 100%'],
  ['meta+1', 'Zoom to fit'],
  ['ctrl+1', 'Zoom to fit'],
  ['arrowup', 'Nudge selection up'],
  ['arrowdown', 'Nudge selection down'],
  ['arrowleft', 'Nudge selection left'],
  ['arrowright', 'Nudge selection right'],
])

function normalizeShortcut(event: KeyboardEvent) {
  const parts: string[] = []
  if (event.metaKey) parts.push('meta')
  if (event.ctrlKey) parts.push('ctrl')
  if (event.shiftKey) parts.push('shift')
  const key =
    event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()
  parts.push(key)
  return parts.join('+')
}

function recordShortcut(event: KeyboardEvent) {
  const key = normalizeShortcut(event)
  const action = shortcuts.get(key)
  if (!action) {
    return
  }
  lastShortcut.value = `${key} → ${action}`
  history.value = [`${key} → ${action}`, ...history.value].slice(0, 6)
}

function seed() {
  engine.importDocument(
    createDemoDocument({
      camera: { x: -20, y: -10, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'kbd-1',
          type: 'text',
          x: 80,
          y: 80,
          width: 220,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'kbd-2',
          type: 'text',
          x: 380,
          y: 170,
          width: 220,
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
    'replace',
  )
}

async function reset() {
  seed()
  history.value = []
  lastShortcut.value = 'Click the board, then try a shortcut.'
  await engine.zoomToFit(60, false)
}

onMounted(reset)
</script>

<template>
  <div
    ref="frame"
    class="demo-frame"
    tabindex="0"
    @keydown.capture="recordShortcut"
  >
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">Reset</button>
      <span class="demo-toolbar-note">{{ lastShortcut }}</span>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
      <BoardRoot :engine="engine" style="height: 360px" />

      <div
        class="border-t border-default bg-elevated p-4 lg:border-t-0 lg:border-l"
      >
        <p class="text-sm font-semibold text-highlighted">Shortcut log</p>
        <p class="mt-1 text-xs leading-5 text-dimmed">
          The board still handles the real interaction. This panel just echoes
          recognized combos.
        </p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="entry in history"
            :key="entry"
            class="rounded-md border border-default bg-default px-3 py-2 font-mono text-xs text-default"
          >
            {{ entry }}
          </li>
          <li
            v-if="history.length === 0"
            class="rounded-md border border-dashed border-default px-3 py-4 text-xs text-dimmed"
          >
            No shortcuts captured yet.
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
