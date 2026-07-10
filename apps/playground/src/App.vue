<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createBoardEngine, type BoardNode } from '@lupinum/board-core'
import {
  connectionsPlugin,
  type ConnectionRouting,
} from '@lupinum/board-connections'
import { BoardConnectionLayer } from '@lupinum/board-connections/vue'
import { historyPlugin } from '@lupinum/board-history'
import { BoardMinimap } from '@lupinum/vue-board/minimap'
import { BoardRoot, type BoardRendererRegistry } from '@lupinum/vue-board'
import GroupNodeRenderer from './components/GroupNodeRenderer.vue'
import ImageNodeRenderer from './components/ImageNodeRenderer.vue'
import PlaygroundToolbar from './components/PlaygroundToolbar.vue'
import PlaygroundPanel from './components/PlaygroundPanel.vue'
import PlaygroundDiagnostics from './components/PlaygroundDiagnostics.vue'
import { useBoardTheme } from './composables/useBoardTheme'

useBoardTheme()

type PlaygroundApi = {
  engine: ReturnType<typeof createBoardEngine>
  seedScene: (count: number) => Promise<void>
  runBenchmark: () => Promise<void>
  exportJsonCanvas: () => string
  importJsonCanvas: () => void
}

// ━━ Engine ━━
const engine = createBoardEngine({
  diagnostics: { traceLimit: 500 },
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'line' },
  plugins: [historyPlugin(), connectionsPlugin()],
})

// ━━ UI state ━━
const selectedScene = ref<25 | 100 | 500>(25)
const showGrid = ref(true)
const snapToGrid = ref(true)
const gridPattern = ref<'line' | 'dot' | 'cross' | 'none'>('line')
const gridSize = ref<10 | 20 | 40>(20)
const benchmarkResult = ref('idle')
const exportedJson = ref('')
const connectionRouting = ref<ConnectionRouting>('bezier')

const showPanel = ref(true)
const showDiagnostics = ref(true)
const showMinimap = ref(true)

// ━━ Renderers ━━
const renderers: BoardRendererRegistry = {
  file: ImageNodeRenderer,
  group: GroupNodeRenderer,
}

const gridOptions = computed(() => ({
  visible: showGrid.value,
  snap: snapToGrid.value,
  size: gridSize.value,
  majorEvery: 5,
  pattern: gridPattern.value,
}))

// ━━ Scene management ━━
function clearBoard(): void {
  const ids = Array.from(engine.getState().nodes.keys())
  if (ids.length > 0) {
    engine.select(ids)
    engine.deleteSelected()
  }
}

async function seedScene(count: number): Promise<void> {
  clearBoard()
  const columns = Math.ceil(Math.sqrt(count))
  const created: BoardNode[] = []

  for (let i = 0; i < count; i += 1) {
    const col = i % columns
    const row = Math.floor(i / columns)
    created.push(
      engine.createNode({
        type: 'text',
        x: col * 320,
        y: row * 220,
        width: 240,
        height: 140,
        text: `Node ${i + 1}\n${col}:${row}`,
      }),
    )
  }

  engine.createNode({
    type: 'file',
    x: -360,
    y: 120,
    width: 280,
    height: 180,
    file: 'Reference tile',
  })

  if (created.length >= 3) {
    engine.plugins.connections.createEdge({
      from: created[0]!.id,
      to: created[1]!.id,
      label: 'A',
      data: {},
    })
    engine.plugins.connections.createEdge({
      from: created[1]!.id,
      to: created[2]!.id,
      label: 'B',
      data: {},
    })
  }

  engine.clearSelection()
  await engine.zoomToFit(80, false)
}

// ━━ Benchmark ━━
async function runBenchmark(): Promise<void> {
  benchmarkResult.value = 'running'
  const samples: number[] = []
  const jsSamples: number[] = []
  const start = performance.now()

  for (let step = 0; step < 60; step += 1) {
    const t0 = performance.now()
    engine.panBy(step % 2 === 0 ? 18 : -12, 10)
    engine.zoomAt({ x: 480, y: 320 }, step % 2 === 0 ? -0.55 : 0.4)
    const tJs = performance.now()
    jsSamples.push(tJs - t0)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(performance.now() - t0)
  }

  const total = performance.now() - start
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length
  const jsAvg = jsSamples.reduce((s, v) => s + v, 0) / jsSamples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms | avg ${avg.toFixed(2)}ms | max ${Math.max(...samples).toFixed(2)}ms | js ${jsAvg.toFixed(2)}ms`
}

// ━━ JSON Canvas ━━
function exportJsonCanvas(): string {
  exportedJson.value = JSON.stringify(engine.exportDocument(), null, 2)
  return exportedJson.value
}

function importJsonCanvas(): void {
  if (!exportedJson.value) return
  engine.loadDocument(JSON.parse(exportedJson.value), { mode: 'replace' })
}

const GROUP_PAD = 36
const DEFAULT_GROUP_W = 400
const DEFAULT_GROUP_H = 300

function worldCenterForViewportBox(
  width: number,
  height: number,
): { x: number; y: number } {
  const vp = engine.getViewportSize()
  const center = engine.screenToWorld({ x: vp.x / 2, y: vp.y / 2 })
  return {
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
  }
}

function wrapSelectionInGroup(): void {
  const sel = engine.getSelection()
  const snap = engine.getState()

  if (sel.length === 0) {
    const { x, y } = worldCenterForViewportBox(DEFAULT_GROUP_W, DEFAULT_GROUP_H)
    const group = engine.createNode({
      type: 'group',
      x,
      y,
      width: DEFAULT_GROUP_W,
      height: DEFAULT_GROUP_H,
      select: false,
    })
    engine.sendToBack(group.id)
    engine.select([group.id])
    return
  }

  const nodes = snap.nodes.filter((n) => sel.includes(n.id))
  if (nodes.length === 0) {
    return
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }
  const group = engine.createNode({
    type: 'group',
    x: minX - GROUP_PAD,
    y: minY - GROUP_PAD,
    width: maxX - minX + GROUP_PAD * 2,
    height: maxY - minY + GROUP_PAD * 2,
    select: false,
  })
  engine.sendToBack(group.id)
  for (const n of nodes) {
    if (n.id === group.id) {
      continue
    }
    engine.updateNode(n.id, { parentId: group.id })
  }
  engine.select([group.id, ...sel.filter((id) => id !== group.id)])
}

// ━━ Image upload ━━
const imageFileInput = ref<HTMLInputElement | null>(null)

function triggerImageUpload(): void {
  imageFileInput.value?.click()
}

function onImageFileSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const src = e.target?.result as string
    const img = new Image()
    img.onload = () => {
      const maxSize = 480
      const ratio = img.naturalWidth / img.naturalHeight
      const width = ratio >= 1 ? maxSize : Math.round(maxSize * ratio)
      const height = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize

      const { x, y } = worldCenterForViewportBox(width, height)
      engine.createNode({
        type: 'file',
        x,
        y,
        width,
        height,
        file: src,
      })
    }
    img.src = src
  }
  reader.readAsDataURL(file)
  ;(event.target as HTMLInputElement).value = ''
}

// ━━ Lifecycle ━━
onMounted(async () => {
  await seedScene(selectedScene.value)
  ;(
    window as Window & { __boardPlayground?: PlaygroundApi }
  ).__boardPlayground = {
    engine,
    seedScene,
    runBenchmark,
    exportJsonCanvas,
    importJsonCanvas,
  }
})
</script>

<template>
  <main class="relative w-screen h-screen overflow-hidden">
    <!-- Canvas (fills viewport) -->
    <BoardRoot
      class="absolute inset-0"
      :engine="engine"
      :grid="gridOptions"
      :renderers="renderers"
    >
      <template #viewport>
        <BoardConnectionLayer :routing="connectionRouting" />
      </template>

      <template #default="{ debugState }">
        <!-- Diagnostics -->
        <Transition name="fade">
          <PlaygroundDiagnostics
            v-if="showDiagnostics"
            :camera="debugState.camera"
            :node-count="debugState.state.nodes.size"
            :selection-count="debugState.selection.length"
            :interaction-mode="debugState.interaction.mode"
            :visible-count="debugState.visibleNodeCount"
            :last-trace="debugState.trace.at(-1)?.event ?? 'none'"
          />
        </Transition>

        <!-- Minimap -->
        <Transition name="fade">
          <div
            v-if="showMinimap"
            class="absolute right-4 bottom-4 z-10 glass-subtle rounded-[10px] shadow-sm overflow-hidden"
          >
            <BoardMinimap :width="200" :height="140" />
          </div>
        </Transition>
      </template>
    </BoardRoot>

    <!-- Hidden file input for image upload -->
    <input
      ref="imageFileInput"
      type="file"
      accept="image/*"
      aria-hidden="true"
      class="hidden"
      tabindex="-1"
      @change="onImageFileSelected"
    />

    <!-- Toolbar -->
    <PlaygroundToolbar
      v-model:selected-scene="selectedScene"
      v-model:show-grid="showGrid"
      v-model:snap-to-grid="snapToGrid"
      v-model:show-diagnostics="showDiagnostics"
      v-model:show-minimap="showMinimap"
      v-model:show-panel="showPanel"
      @seed="seedScene(selectedScene)"
      @fit="engine.zoomToFit(40, true)"
      @add-image="triggerImageUpload"
      @wrap-group="wrapSelectionInGroup"
    />

    <!-- Settings panel -->
    <Transition name="panel-slide">
      <PlaygroundPanel
        v-if="showPanel"
        v-model:grid-size="gridSize"
        v-model:grid-pattern="gridPattern"
        v-model:connection-routing="connectionRouting"
        :benchmark-result="benchmarkResult"
        :exported-json="exportedJson"
        @close="showPanel = false"
        @benchmark="runBenchmark"
        @export="exportJsonCanvas"
        @import="importJsonCanvas"
      />
    </Transition>
  </main>
</template>

<style scoped>
:deep(.board-node__content),
:deep(.board-node__editor) {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--board-fg);
  letter-spacing: -0.005em;
}

:deep(.board-connection-layer) {
  color: var(--board-edge-color);
}
</style>
