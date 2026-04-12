<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createCanvasEngine, type CanvasNode } from '@canvas/core'
import { connectionPlugin, CanvasConnectionLayer, type CanvasEdge } from '@canvas/connections'
import { historyPlugin } from '@canvas/history'
import { CanvasMinimap } from '@canvas/minimap'
import { jsonCanvasSerializer } from '@canvas/serializer'
import { CanvasRoot, type CanvasRendererRegistry } from '@canvas/vue'
import ImageNodeRenderer from './components/ImageNodeRenderer.vue'
import PlaygroundToolbar from './components/PlaygroundToolbar.vue'
import PlaygroundPanel from './components/PlaygroundPanel.vue'
import PlaygroundDiagnostics from './components/PlaygroundDiagnostics.vue'

type PlaygroundApi = {
  engine: ReturnType<typeof createCanvasEngine>
  seedScene: (count: number) => Promise<void>
  runBenchmark: () => Promise<void>
  exportJsonCanvas: () => string
  importJsonCanvas: () => void
}

// ━━ Engine ━━
const engine = createCanvasEngine({
  diagnostics: { traceLimit: 500 },
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'line' },
  plugins: [historyPlugin(), connectionPlugin()]
})

// ━━ UI state ━━
const selectedScene = ref<25 | 100 | 500>(25)
const showGrid = ref(true)
const snapToGrid = ref(true)
const gridPattern = ref<'line' | 'dot' | 'cross' | 'none'>('line')
const gridSize = ref<10 | 20 | 40>(20)
const benchmarkResult = ref('idle')
const exportedJson = ref('')

const showPanel = ref(true)
const showDiagnostics = ref(true)
const showMinimap = ref(true)

// ━━ Renderers ━━
const renderers: CanvasRendererRegistry = {
  image: ImageNodeRenderer
}

const gridOptions = computed(() => ({
  visible: showGrid.value,
  snap: snapToGrid.value,
  size: gridSize.value,
  majorEvery: 5,
  pattern: gridPattern.value
}))

// ━━ Scene management ━━
function getConnections() {
  return engine as typeof engine & {
    createEdge?: (input: Omit<CanvasEdge, 'id' | 'zIndex'> & { id?: string }) => CanvasEdge
    getEdges?: () => CanvasEdge[]
  }
}

function clearBoard(): void {
  const ids = engine.getSnapshot().nodes.map((n) => n.id)
  if (ids.length > 0) {
    engine.select(ids)
    engine.deleteSelected()
  }
}

async function seedScene(count: number): Promise<void> {
  clearBoard()
  const columns = Math.ceil(Math.sqrt(count))
  const created: CanvasNode[] = []

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
        data: { content: `Node ${i + 1}\n${col}:${row}` }
      })
    )
  }

  engine.createNode({
    type: 'image',
    x: -360,
    y: 120,
    width: 280,
    height: 180,
    data: { alt: 'Reference tile' }
  })

  const cx = getConnections()
  if (cx.createEdge && created.length >= 3) {
    cx.createEdge({ from: created[0]!.id, to: created[1]!.id, data: { label: 'A' } })
    cx.createEdge({ from: created[1]!.id, to: created[2]!.id, data: { label: 'B' } })
  }

  engine.clearSelection()
  await engine.zoomToFit(80, false)
}

// ━━ Benchmark ━━
async function runBenchmark(): Promise<void> {
  benchmarkResult.value = 'running'
  const samples: number[] = []
  const start = performance.now()

  for (let step = 0; step < 60; step += 1) {
    const t0 = performance.now()
    engine.panBy(step % 2 === 0 ? 18 : -12, 10)
    engine.zoomAt({ x: 480, y: 320 }, step % 2 === 0 ? -0.55 : 0.4)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(performance.now() - t0)
  }

  const total = performance.now() - start
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms | avg ${avg.toFixed(2)}ms | max ${Math.max(...samples).toFixed(2)}ms`
}

// ━━ JSON Canvas ━━
function exportJsonCanvas(): string {
  exportedJson.value = jsonCanvasSerializer.export(engine)
  return exportedJson.value
}

function importJsonCanvas(): void {
  if (!exportedJson.value) return
  const doc = jsonCanvasSerializer.parse(exportedJson.value)
  const snapshot = jsonCanvasSerializer.toSnapshot(doc)
  engine.importJSON(JSON.stringify(snapshot), 'replace')
}

// ━━ Lifecycle ━━
onMounted(async () => {
  await seedScene(selectedScene.value)
  ;(window as Window & { __canvasPlayground?: PlaygroundApi }).__canvasPlayground = {
    engine,
    seedScene,
    runBenchmark,
    exportJsonCanvas,
    importJsonCanvas
  }
})
</script>

<template>
  <main class="relative w-screen h-screen overflow-hidden">
    <!-- Canvas (fills viewport) -->
    <CanvasRoot
      class="absolute inset-0"
      :engine="engine"
      :grid="gridOptions"
      :renderers="renderers"
    >
      <template #viewport>
        <CanvasConnectionLayer />
      </template>

      <template #default="{ debugState }">
        <!-- Diagnostics -->
        <Transition name="fade">
          <PlaygroundDiagnostics
            v-if="showDiagnostics"
            :camera="debugState.camera"
            :node-count="debugState.snapshot.nodes.length"
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
            class="absolute right-4 bottom-4 z-10 glass-light border border-black/6 rounded-[10px] shadow-sm overflow-hidden"
          >
            <CanvasMinimap :width="200" :height="140" />
          </div>
        </Transition>
      </template>
    </CanvasRoot>

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
    />

    <!-- Settings panel -->
    <Transition name="panel-slide">
      <PlaygroundPanel
        v-if="showPanel"
        v-model:grid-size="gridSize"
        v-model:grid-pattern="gridPattern"
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
/* Deep overrides for canvas library components — uses raw values
   since theme() is unavailable in Vue scoped CSS with Tailwind 4 */
:deep(.canvas-root) {
  background: var(--color-stone-50);
}

:deep(.canvas-node) {
  border-color: rgba(28, 25, 23, 0.14);
  border-radius: 8px;
  background: white;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.03),
    0 4px 12px -4px rgba(0, 0, 0, 0.04);
}

:deep(.canvas-node.is-selected) {
  outline: 2px solid var(--color-teal-600);
  outline-offset: -1px;
  box-shadow:
    0 0 0 4px rgba(13, 148, 136, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.06);
}

:deep(.canvas-node.is-locked) {
  opacity: 0.55;
}

:deep(.canvas-node__content),
:deep(.canvas-node__editor) {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-stone-900);
}

:deep(.canvas-connection-layer) {
  color: var(--color-stone-400);
}

:deep(.canvas-node-handle) {
  background: white;
  border: 1.5px solid var(--color-teal-600);
  border-radius: 2px;
}
</style>
