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

const showPanel = ref(true)
const showDiagnostics = ref(true)
const showMinimap = ref(true)

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
  <main class="playground">
    <CanvasRoot
      class="canvas"
      :engine="engine"
      :grid="gridOptions"
      :renderers="renderers"
    >
      <template #viewport>
        <CanvasConnectionLayer />
      </template>

      <template #default="{ debugState }">
        <Transition name="fade">
          <aside v-if="showDiagnostics" class="diag">
            <dl class="diag-grid">
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
                <dt>Selected</dt>
                <dd>{{ debugState.selection.length }}</dd>
              </div>
              <div>
                <dt>Mode</dt>
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
          </aside>
        </Transition>

        <Transition name="fade">
          <CanvasMinimap
            v-if="showMinimap"
            class="minimap"
            :width="200"
            :height="140"
          />
        </Transition>
      </template>
    </CanvasRoot>

    <!-- ━━ Floating toolbar ━━ -->
    <header class="toolbar">
      <div class="toolbar-brand">
        <svg class="brand-diamond" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="2.5" y="2.5" width="9" height="9" rx="2" transform="rotate(45 7 7)" fill="currentColor" />
        </svg>
        <span>canvas</span>
      </div>

      <i class="sep" aria-hidden="true" />

      <div class="toolbar-group">
        <select v-model="selectedScene" class="tselect" aria-label="Scene size">
          <option :value="25">25 nodes</option>
          <option :value="100">100 nodes</option>
          <option :value="500">500 nodes</option>
        </select>
        <button class="tbtn" @click="seedScene(selectedScene)">Seed</button>
      </div>

      <i class="sep" aria-hidden="true" />

      <div class="toolbar-group">
        <button
          class="tbtn"
          :class="{ on: showGrid }"
          @click="showGrid = !showGrid"
        >
          Grid
        </button>
        <button
          class="tbtn"
          :class="{ on: snapToGrid }"
          @click="snapToGrid = !snapToGrid"
        >
          Snap
        </button>
      </div>

      <i class="sep" aria-hidden="true" />

      <button class="tbtn" @click="engine.zoomToFit(40, true)">Fit</button>

      <i class="sep" aria-hidden="true" />

      <div class="toolbar-group toolbar-group--tight">
        <button
          class="tbtn tbtn--sq"
          :class="{ on: showDiagnostics }"
          title="Toggle diagnostics"
          @click="showDiagnostics = !showDiagnostics"
        >
          <!-- terminal -->
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M5 6.5l2 1.5-2 1.5" />
            <line x1="9" y1="10" x2="11" y2="10" />
          </svg>
        </button>
        <button
          class="tbtn tbtn--sq"
          :class="{ on: showMinimap }"
          title="Toggle minimap"
          @click="showMinimap = !showMinimap"
        >
          <!-- minimap -->
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <rect x="9" y="8.5" width="3.5" height="3" rx="0.5" fill="currentColor" opacity="0.3" stroke="none" />
          </svg>
        </button>
        <button
          class="tbtn tbtn--sq"
          :class="{ on: showPanel }"
          title="Toggle settings panel"
          @click="showPanel = !showPanel"
        >
          <!-- panel -->
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <line x1="10" y1="3" x2="10" y2="13" />
          </svg>
        </button>
      </div>
    </header>

    <!-- ━━ Settings panel ━━ -->
    <Transition name="panel">
      <aside v-if="showPanel" class="panel">
        <div class="panel-head">
          <h2>Settings</h2>
          <button class="panel-x" aria-label="Close settings" @click="showPanel = false">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        </div>

        <section class="psec">
          <h3>Grid</h3>
          <label class="field">
            <span>Size</span>
            <select v-model="gridSize">
              <option :value="10">10 px</option>
              <option :value="20">20 px</option>
              <option :value="40">40 px</option>
            </select>
          </label>
          <label class="field">
            <span>Pattern</span>
            <select v-model="gridPattern">
              <option value="line">Line</option>
              <option value="dot">Dot</option>
              <option value="cross">Cross</option>
              <option value="none">None</option>
            </select>
          </label>
        </section>

        <section class="psec">
          <h3>Benchmark</h3>
          <button class="pbtn" @click="runBenchmark">Run benchmark</button>
          <p class="bench-out">{{ benchmarkResult }}</p>
        </section>

        <section class="psec">
          <h3>Data</h3>
          <div class="pbtn-row">
            <button class="pbtn" @click="exportJsonCanvas">Export</button>
            <button class="pbtn" @click="importJsonCanvas">Import</button>
          </div>
          <pre v-if="exportedJson" class="json-out">{{ exportedJson.slice(0, 300) }}</pre>
        </section>

        <section class="psec psec--last">
          <h3>Shortcuts</h3>
          <dl class="shortcut-list">
            <div><dt>Double-click</dt><dd>Create node</dd></div>
            <div><dt>Space + drag</dt><dd>Pan canvas</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>A</kbd></dt><dd>Select all</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>D</kbd></dt><dd>Duplicate</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>Z</kbd> / <kbd>Y</kbd></dt><dd>Undo / Redo</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>C</kbd> / <kbd>V</kbd></dt><dd>Copy / Paste</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>0</kbd></dt><dd>Reset zoom</dd></div>
            <div><dt><kbd>Ctrl</kbd><kbd>1</kbd></dt><dd>Zoom to fit</dd></div>
            <div><dt><kbd>Del</kbd></dt><dd>Delete</dd></div>
            <div><dt>Arrows</dt><dd>Nudge selection</dd></div>
          </dl>
        </section>
      </aside>
    </Transition>
  </main>
</template>

<style scoped>
/* ━━ Design tokens ━━ */
:global(:root) {
  --font-sans: 'Outfit', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;
  --bg: #fafaf9;
  --glass: rgba(255, 255, 255, 0.82);
  --glass-solid: #fffffe;
  --text-1: #1c1917;
  --text-2: #57534e;
  --text-3: #a8a29e;
  --border: rgba(28, 25, 23, 0.06);
  --border-strong: rgba(28, 25, 23, 0.12);
  --accent: #0d9488;
  --accent-soft: rgba(13, 148, 136, 0.08);
  --shadow-float:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 4px 16px -2px rgba(0, 0, 0, 0.06),
    0 12px 32px -8px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.04);
  --radius: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

:global(body) {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bg);
  font-family: var(--font-sans);
  color: var(--text-1);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:global(*) {
  box-sizing: border-box;
}

:global(h1, h2, h3, p, dl, pre, dd) {
  margin: 0;
}

/* ━━ Layout ━━ */
.playground {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvas {
  position: absolute;
  inset: 0;
}

/* ━━ Toolbar ━━ */
.toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--glass);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-float);
  transform: translateX(-50%);
  pointer-events: auto;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px 0 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-1);
  cursor: default;
  user-select: none;
}

.brand-diamond {
  flex-shrink: 0;
  color: var(--accent);
  transition: transform 0.4s var(--ease-spring);
}

.toolbar-brand:hover .brand-diamond {
  transform: rotate(90deg);
}

.sep {
  display: block;
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--border-strong);
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-group--tight {
  gap: 1px;
}

/* Toolbar select */
.tselect {
  appearance: none;
  height: 32px;
  padding: 0 26px 0 10px;
  border: none;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 8px center;
  background-color: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}

.tselect:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-1);
}

.tselect:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

/* Toolbar button */
.tbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.12s, color 0.12s, transform 0.1s;
}

.tbtn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-1);
}

.tbtn:active {
  transform: scale(0.97);
}

.tbtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.tbtn.on {
  background-color: var(--text-1);
  color: white;
}

.tbtn.on:hover {
  background-color: #292524;
  color: white;
}

.tbtn--sq {
  width: 32px;
  padding: 0;
}

/* ━━ Settings panel ━━ */
.panel {
  position: fixed;
  top: 68px;
  right: 16px;
  z-index: 90;
  width: 264px;
  display: flex;
  flex-direction: column;
  background: var(--glass);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  max-height: calc(100vh - 84px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.08) transparent;
  pointer-events: auto;
}

.panel::-webkit-scrollbar {
  width: 5px;
}

.panel::-webkit-scrollbar-track {
  background: transparent;
}

.panel::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 3px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}

.panel-head h2 {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-1);
}

.panel-x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}

.panel-x:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-1);
}

/* Panel sections */
.psec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}

.psec:first-of-type {
  border-top: none;
  padding-top: 12px;
}

.psec--last {
  padding-bottom: 16px;
}

.psec h3 {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0 0 2px;
}

/* Field row */
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.field span {
  font-size: 13px;
  color: var(--text-2);
}

.field select {
  appearance: none;
  width: 110px;
  padding: 6px 28px 6px 10px;
  border: 1px solid var(--border-strong);
  background:
    var(--glass-solid)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-1);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.field select:hover {
  border-color: var(--text-3);
}

.field select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Panel buttons */
.pbtn {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid var(--border-strong);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s;
}

.pbtn:hover {
  background-color: rgba(0, 0, 0, 0.03);
  border-color: var(--text-3);
}

.pbtn:active {
  transform: scale(0.98);
}

.pbtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.pbtn-row {
  display: flex;
  gap: 6px;
}

/* Benchmark output */
.bench-out {
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-3);
  word-break: break-all;
}

/* JSON preview */
.json-out {
  padding: 10px;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 140px;
  overflow-y: auto;
}

/* Shortcuts */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shortcut-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shortcut-list dt {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.shortcut-list dd {
  font-size: 12px;
  color: var(--text-3);
  text-align: right;
}

.shortcut-list kbd {
  display: inline-block;
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-2);
}

/* ━━ Diagnostics ━━ */
.diag {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 10;
  padding: 10px 14px;
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
}

.diag-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
}

.diag-grid div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.diag-grid dt {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-3);
  white-space: nowrap;
}

.diag-grid dd {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

/* ━━ Minimap ━━ */
.minimap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  background: var(--glass) !important;
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* ━━ Canvas overrides ━━ */
.playground :deep(.canvas-root) {
  background: var(--bg);
}

.playground :deep(.canvas-node) {
  border-color: rgba(28, 25, 23, 0.14);
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px -4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s;
}

.playground :deep(.canvas-node.is-selected) {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
  box-shadow: 0 0 0 4px var(--accent-soft), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.playground :deep(.canvas-node.is-locked) {
  opacity: 0.55;
}

.playground :deep(.canvas-node__content) {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-1);
}

.playground :deep(.canvas-node__editor) {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-1);
}

.playground :deep(.canvas-connection-layer) {
  color: var(--text-3);
}

.playground :deep(.playground-image-node) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 14px;
  background: #f7f6f4;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-2);
}

.playground :deep(.playground-image-node strong) {
  font-weight: 600;
  color: var(--text-1);
}

.playground :deep(.canvas-node-handle) {
  background: white;
  border: 1.5px solid var(--accent);
  border-radius: 2px;
}

/* ━━ Transitions ━━ */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.panel-enter-active {
  transition: opacity 0.25s ease, transform 0.25s var(--ease-out);
}

.panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
