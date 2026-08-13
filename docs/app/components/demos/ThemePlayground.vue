<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
})

const colors = reactive({
  bg: '#f8fafc',
  fg: '#0f172a',
  nodeBg: '#ffffff',
  nodeBorder: '#cbd5e1',
  accent: '#0ea5e9',
})

const boardStyle = computed(() => ({
  '--board-bg': colors.bg,
  '--board-fg': colors.fg,
  '--board-node-bg': colors.nodeBg,
  '--board-node-border': colors.nodeBorder,
  '--board-node-stripe': `${colors.fg}14`,
  '--board-accent': colors.accent,
  '--board-handle-shadow': `${colors.fg}33`,
}))

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'theme-1',
          type: 'text',
          x: 70,
          y: 70,
          width: 240,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'theme-2',
          type: 'text',
          x: 370,
          y: 190,
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

function resetColors() {
  colors.bg = '#f8fafc'
  colors.fg = '#0f172a'
  colors.nodeBg = '#ffffff'
  colors.nodeBorder = '#cbd5e1'
  colors.accent = '#0ea5e9'
}

async function reset() {
  seed()
  resetColors()
  await engine.zoomToFit(60, false)
}

onMounted(reset)
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">Reset theme</button>
      <span class="demo-toolbar-note"
        >Change the CSS custom properties and the board updates
        immediately.</span
      >
    </div>

    <div class="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div
        class="border-b border-default bg-elevated p-4 lg:border-r lg:border-b-0"
      >
        <div class="space-y-4">
          <label class="demo-color-field">
            <div>
              <span>Board background</span
              ><code class="demo-color-var">--board-bg</code>
            </div>
            <input v-model="colors.bg" type="color" />
          </label>
          <label class="demo-color-field">
            <div>
              <span>Board foreground</span
              ><code class="demo-color-var">--board-fg</code>
            </div>
            <input v-model="colors.fg" type="color" />
          </label>
          <label class="demo-color-field">
            <div>
              <span>Node background</span
              ><code class="demo-color-var">--board-node-bg</code>
            </div>
            <input v-model="colors.nodeBg" type="color" />
          </label>
          <label class="demo-color-field">
            <div>
              <span>Node border</span
              ><code class="demo-color-var">--board-node-border</code>
            </div>
            <input v-model="colors.nodeBorder" type="color" />
          </label>
          <label class="demo-color-field">
            <div>
              <span>Accent</span
              ><code class="demo-color-var">--board-accent</code>
            </div>
            <input v-model="colors.accent" type="color" />
          </label>
        </div>
      </div>

      <div class="p-4">
        <div
          class="overflow-hidden rounded-md border border-default"
          :style="boardStyle"
        >
          <BoardRoot
            :engine="engine"
            :grid="{ minorOpacity: 0.12, majorOpacity: 0.18, fadeEdges: true }"
            style="height: 360px"
          />
        </div>
      </div>
    </div>
  </div>
</template>
