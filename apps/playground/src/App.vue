<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { createCanvasEngine, type CanvasNode } from '@canvas/core'
import { connectionPlugin, CanvasConnectionLayer, type CanvasEdge } from '@canvas/connections'
import { historyPlugin } from '@canvas/history'
import { CanvasMinimap } from '@canvas/minimap'
import { jsonCanvasSerializer } from '@canvas/serializer'
import { CanvasRoot, type CanvasRendererRegistry } from '@canvas/vue'

type PlaygroundApi = {
  engine: ReturnType<typeof createCanvasEngine>
  seedScene: (count: number) => Promise<void>
  runBenchmark: () => Promise<void>
  exportJsonCanvas: () => string
  importJsonCanvas: () => void
}

const engine = createCanvasEngine({
  diagnostics: { traceLimit: 500 },
  grid: {
    size: 20,
    majorEvery: 5,
    snap: true,
    pattern: 'line'
  },
  plugins: [historyPlugin(), connectionPlugin()]
})

const selectedScene = ref<25 | 100 | 500>(25)
const showGrid = ref(true)
const snapToGrid = ref(true)
const gridPattern = ref<'line' | 'dot' | 'cross' | 'none'>('line')
const gridSize = ref<10 | 20 | 40>(20)
const benchmarkResult = ref('idle')
const exportedJson = ref('')

const imageRenderer = defineComponent({
  name: 'ImageNodeRenderer',
  props: {
    node: {
      type: Object as () => CanvasNode,
      required: true
    },
    selected: {
      type: Boolean,
      required: true
    }
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: ['playground-image-node', props.selected && 'is-selected']
        },
        [
          h('strong', 'Image'),
          h('span', String((props.node.data as Record<string, unknown>).alt ?? 'Untitled asset'))
        ]
      )
  }
})

const renderers: CanvasRendererRegistry = {
  image: imageRenderer
}

const gridOptions = computed(() => ({
  visible: showGrid.value,
  snap: snapToGrid.value,
  size: gridSize.value,
  majorEvery: 5,
  pattern: gridPattern.value
}))

function getConnections() {
  return engine as typeof engine & {
    createEdge?: (input: Omit<CanvasEdge, 'id' | 'zIndex'> & { id?: string }) => CanvasEdge
    getEdges?: () => CanvasEdge[]
  }
}

function clearBoard(): void {
  const ids = engine.getSnapshot().nodes.map((node) => node.id)
  if (ids.length > 0) {
    engine.select(ids)
    engine.deleteSelected()
  }
}

async function seedScene(count: number): Promise<void> {
  clearBoard()
  const columns = Math.ceil(Math.sqrt(count))
  const created: CanvasNode[] = []

  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    created.push(
      engine.createNode({
        type: 'text',
        x: column * 320,
        y: row * 220,
        width: 240,
        height: 140,
        data: {
          content: `Node ${index + 1}\n${column}:${row}`
        }
      })
    )
  }

  engine.createNode({
    type: 'image',
    x: -360,
    y: 120,
    width: 280,
    height: 180,
    data: {
      alt: 'Reference tile'
    }
  })

  const connections = getConnections()
  if (connections.createEdge && created.length >= 3) {
    connections.createEdge({ from: created[0]!.id, to: created[1]!.id, data: { label: 'A' } })
    connections.createEdge({ from: created[1]!.id, to: created[2]!.id, data: { label: 'B' } })
  }

  engine.clearSelection()
  await engine.zoomToFit(80, false)
}

async function runBenchmark(): Promise<void> {
  benchmarkResult.value = 'running'
  const samples: number[] = []
  const start = performance.now()

  for (let step = 0; step < 60; step += 1) {
    const frameStart = performance.now()
    engine.panBy(step % 2 === 0 ? 18 : -12, 10)
    engine.zoomAt({ x: 480, y: 320 }, step % 2 === 0 ? -0.55 : 0.4)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(performance.now() - frameStart)
  }

  const total = performance.now() - start
  const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms | avg ${average.toFixed(2)}ms | max ${Math.max(...samples).toFixed(2)}ms`
}

function exportJsonCanvas(): string {
  exportedJson.value = jsonCanvasSerializer.export(engine)
  return exportedJson.value
}

function importJsonCanvas(): void {
  if (!exportedJson.value) {
    return
  }
  const document = jsonCanvasSerializer.parse(exportedJson.value)
  const snapshot = jsonCanvasSerializer.toSnapshot(document)
  engine.importJSON(JSON.stringify(snapshot), 'replace')
}

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
  <main class="playground-shell">
    <aside class="playground-panel">
      <div>
        <p class="eyebrow">@canvas</p>
        <h1>Primitive Playground</h1>
        <p class="lede">
          Headless engine, Vue primitives, plugins, diagnostics, and benchmark scaffolding in one surface.
        </p>
      </div>

      <label class="control">
        <span>Scene size</span>
        <select v-model="selectedScene">
          <option :value="25">25 nodes</option>
          <option :value="100">100 nodes</option>
          <option :value="500">500 nodes</option>
        </select>
      </label>

      <label class="control">
        <span>Grid size</span>
        <select v-model="gridSize">
          <option :value="10">10 px</option>
          <option :value="20">20 px</option>
          <option :value="40">40 px</option>
        </select>
      </label>

      <label class="control">
        <span>Grid pattern</span>
        <select v-model="gridPattern">
          <option value="line">Line</option>
          <option value="dot">Dot</option>
          <option value="cross">Cross</option>
          <option value="none">None</option>
        </select>
      </label>

      <label class="toggle">
        <input v-model="showGrid" type="checkbox" />
        <span>Show grid</span>
      </label>

      <label class="toggle">
        <input v-model="snapToGrid" type="checkbox" />
        <span>Snap to grid</span>
      </label>

      <div class="button-row">
        <button type="button" @click="seedScene(selectedScene)">Seed scene</button>
        <button type="button" @click="runBenchmark">Run benchmark</button>
        <button type="button" @click="exportJsonCanvas">Export JSON Canvas</button>
        <button type="button" @click="importJsonCanvas">Import JSON Canvas</button>
      </div>

      <p class="benchmark">{{ benchmarkResult }}</p>
      <p class="notes">
        Double-click creates a text node. Drag on empty space box-selects. Space+drag or middle-mouse pans. Ctrl/Cmd+A, D, C, V, Z work. The minimap and edge layer are live plugin consumers.
      </p>
    </aside>

    <section class="playground-canvas">
      <CanvasRoot :engine="engine" :grid="gridOptions" :renderers="renderers">
        <template #viewport>
          <CanvasConnectionLayer />
        </template>

        <template #default="{ debugState }">
          <aside class="debug-overlay">
            <h2>Diagnostics</h2>
            <dl>
              <div>
                <dt>Camera</dt>
                <dd data-testid="camera-value">
                  {{ debugState.camera.x.toFixed(1) }}, {{ debugState.camera.y.toFixed(1) }}, {{ debugState.camera.z.toFixed(2) }}
                </dd>
              </div>
              <div>
                <dt>Nodes</dt>
                <dd data-testid="node-count">{{ debugState.snapshot.nodes.length }}</dd>
              </div>
              <div>
                <dt>Selection</dt>
                <dd>{{ debugState.selection.length }}</dd>
              </div>
              <div>
                <dt>Interaction</dt>
                <dd>{{ debugState.interaction.mode }}</dd>
              </div>
              <div>
                <dt>Visible</dt>
                <dd>{{ debugState.visibleNodeCount }}</dd>
              </div>
              <div>
                <dt>Trace</dt>
                <dd>{{ debugState.trace.at(-1)?.event ?? 'none' }}</dd>
              </div>
            </dl>
            <pre class="debug-json">{{ exportedJson.slice(0, 220) }}</pre>
          </aside>

          <CanvasMinimap class="playground-minimap" :width="220" :height="150" />
        </template>
      </CanvasRoot>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #e2e8f0;
  color: #0f172a;
  font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

.playground-shell {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
}

.playground-panel {
  display: grid;
  gap: 20px;
  padding: 24px;
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.84);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1,
h2,
p,
dl,
pre {
  margin: 0;
}

h1 {
  font-size: 36px;
  line-height: 0.98;
}

.lede,
.notes,
.benchmark,
.debug-json {
  line-height: 1.5;
  color: #334155;
}

.control {
  display: grid;
  gap: 6px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control select,
.button-row button {
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: white;
  padding: 10px 12px;
  font: inherit;
}

.button-row {
  display: grid;
  gap: 8px;
}

.playground-canvas {
  position: relative;
  min-width: 0;
  min-height: 100vh;
}

.playground-canvas :deep(.canvas-root) {
  position: absolute;
  inset: 0;
}

.playground-canvas :deep(.canvas-connection-layer) {
  color: #475569;
}

.playground-canvas :deep(.playground-image-node) {
  display: grid;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 14px;
  background: #f8fafc;
}

.debug-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 280px;
  display: grid;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.debug-overlay dl {
  display: grid;
  gap: 8px;
}

.debug-overlay dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.debug-json {
  min-height: 72px;
  font-size: 12px;
  white-space: pre-wrap;
}

.playground-minimap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.12);
}
</style>
