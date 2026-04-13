<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { GridPattern } from '@lupinum/board-core'
import { BoardConnectionLayer } from '@lupinum/board-connections'
import { BoardMinimap } from '@lupinum/board-minimap'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import DemoDiagnostics from '~/components/DemoDiagnostics.vue'
import DemoGroupNodeRenderer from '~/components/DemoGroupNodeRenderer.vue'
import DemoImageNodeRenderer from '~/components/DemoImageNodeRenderer.vue'
import DemoSidebar from '~/components/DemoSidebar.vue'
import DemoToolbar from '~/components/DemoToolbar.vue'
import {
  DEMO_SCENES,
  createDemoEngine,
  exportDemoDocument,
  getDemoCounts,
  getLastTraceLabel,
  importDemoDocument,
  loadDemoScene,
  type DemoSceneId,
  type DemoSceneOption,
  wrapSelectionInGroup,
} from '~/lib/demo'

useHead({
  title: '@lupinum/nuxt-board playground',
  meta: [
    {
      name: 'description',
      content: 'A Nuxt SSR demo for @lupinum/nuxt-board with deterministic seeded scenes, plugins, minimap, and JSON import/export.',
    },
  ],
})

const defaultSceneId: DemoSceneId = 'workflow'
const seeded = createDemoEngine(defaultSceneId)
const engine = seeded.engine

const sceneId = ref<DemoSceneId>(defaultSceneId)
const activeScene = ref<DemoSceneOption>(seeded.scene)
const showGrid = ref(true)
const snapToGrid = ref(true)
const showMinimap = ref(true)
const showDiagnostics = ref(true)
const showPanel = ref(true)
const gridSize = ref(24)
const gridPattern = ref<GridPattern>('line')
const benchmarkResult = ref('idle')
const documentText = ref('')
const status = ref('Scene seeded from deterministic data for SSR hydration.')
const version = ref(0)

const renderers: BoardRendererRegistry = {
  image: DemoImageNodeRenderer,
  group: DemoGroupNodeRenderer,
}

const unsubscribes = [
  engine.on('command:after', () => {
    version.value += 1
  }),
  engine.on('edge:created', () => {
    version.value += 1
  }),
  engine.on('edge:deleted', () => {
    version.value += 1
  }),
  engine.on('history:undo', () => {
    version.value += 1
  }),
  engine.on('history:redo', () => {
    version.value += 1
  }),
]

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
})

const stats = computed(() => {
  version.value
  return getDemoCounts(engine)
})

const gridOptions = computed(() => ({
  visible: showGrid.value,
  snap: snapToGrid.value,
  size: gridSize.value,
  majorEvery: 4,
  pattern: gridPattern.value,
}))

function reseedScene(): void {
  activeScene.value = loadDemoScene(engine, sceneId.value)
  const grid = engine.getSnapshot().grid
  gridSize.value = grid.size
  gridPattern.value = grid.pattern
  snapToGrid.value = grid.snap
  documentText.value = ''
  benchmarkResult.value = 'idle'
  status.value = `${activeScene.value.label} restored from deterministic scene data.`
  version.value += 1
}

watch(sceneId, (next, prev) => {
  if (next !== prev) {
    reseedScene()
  }
})

function exportDocument(): void {
  documentText.value = exportDemoDocument(engine)
  status.value = 'Exported current board as JSON Canvas.'
}

function importDocument(): void {
  if (!documentText.value.trim()) {
    status.value = 'Nothing to import yet.'
    return
  }
  try {
    importDemoDocument(engine, documentText.value)
    const grid = engine.getSnapshot().grid
    gridSize.value = grid.size
    gridPattern.value = grid.pattern
    snapToGrid.value = grid.snap
    status.value = 'Imported JSON Canvas into the live engine.'
    version.value += 1
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Import failed.'
  }
}

async function runBenchmark(): Promise<void> {
  benchmarkResult.value = 'running'
  const samples: number[] = []
  const start = performance.now()

  for (let step = 0; step < 40; step += 1) {
    const t0 = performance.now()
    engine.panBy(step % 2 === 0 ? 18 : -12, 10)
    engine.zoomAt({ x: 520, y: 260 }, step % 2 === 0 ? -0.6 : 0.42)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(performance.now() - t0)
  }

  const total = performance.now() - start
  const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms · avg ${average.toFixed(2)}ms · max ${Math.max(...samples).toFixed(2)}ms`
  status.value = 'Benchmark finished on the current scene.'
}

function fitScene(): void {
  void engine.zoomToFit(80, true)
}

function groupSelection(): void {
  wrapSelectionInGroup(engine)
  status.value = 'Grouped the current selection.'
  version.value += 1
}
</script>

<template>
  <main class="demo-shell">
    <section class="demo-hero">
      <div class="demo-hero__copy">
        <p class="demo-hero__eyebrow">Nuxt SSR Playground</p>
        <h1>Interactive board markup, rendered on the server before hydration.</h1>
        <p class="demo-hero__lede">
          This playground uses deterministic scene data so Nuxt can server-render the board, then hydrate into the same
          live engine with history, connections, minimap, and JSON import/export intact.
        </p>
      </div>

      <dl class="demo-stats">
        <div class="demo-stats__card">
          <dt>Nodes</dt>
          <dd>{{ stats.nodes }}</dd>
        </div>
        <div class="demo-stats__card">
          <dt>Edges</dt>
          <dd>{{ stats.edges }}</dd>
        </div>
        <div class="demo-stats__card">
          <dt>Undo Steps</dt>
          <dd>{{ stats.history }}</dd>
        </div>
        <div class="demo-stats__card">
          <dt>Hydration</dt>
          <dd>Deterministic</dd>
        </div>
      </dl>
    </section>

    <section class="demo-stage-shell">
      <div class="demo-stage-shell__header">
        <div>
          <p class="demo-stage-shell__eyebrow">{{ activeScene.label }}</p>
          <h2>{{ activeScene.summary }}</h2>
        </div>
        <p class="demo-stage-shell__status">{{ status }}</p>
      </div>

      <DemoToolbar
        v-model:scene-id="sceneId"
        v-model:show-grid="showGrid"
        v-model:snap-to-grid="snapToGrid"
        v-model:show-minimap="showMinimap"
        v-model:show-diagnostics="showDiagnostics"
        v-model:show-panel="showPanel"
        :scenes="DEMO_SCENES"
        @benchmark="runBenchmark"
        @export="exportDocument"
        @fit="fitScene"
        @group="groupSelection"
        @reseed="reseedScene"
      />

      <div class="demo-stage-grid">
        <section class="demo-board-shell">
          <BoardRoot
            class="demo-board"
            :engine="engine"
            :grid="gridOptions"
            :renderers="renderers"
          >
            <template #viewport>
              <BoardConnectionLayer />
            </template>

            <template #default="{ debugState }">
              <DemoDiagnostics
                v-if="showDiagnostics"
                class="demo-diagnostics"
                :camera="debugState.camera"
                :nodes="stats.nodes"
                :edges="stats.edges"
                :selection="stats.selection"
                :visible="debugState.visibleNodeCount"
                :trace="getLastTraceLabel(engine)"
              />

              <div v-if="showMinimap" class="demo-minimap">
                <BoardMinimap :width="208" :height="148" />
              </div>
            </template>
          </BoardRoot>
        </section>

        <DemoSidebar
          v-if="showPanel"
          v-model:grid-size="gridSize"
          v-model:grid-pattern="gridPattern"
          v-model:document-text="documentText"
          :scene-label="activeScene.label"
          :scene-summary="activeScene.summary"
          :benchmark-result="benchmarkResult"
          :status="status"
          @import="importDocument"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.demo-shell {
  display: grid;
  gap: 1.5rem;
  min-height: 100vh;
  padding: 2rem;
}

.demo-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 28rem);
  gap: 1.5rem;
  align-items: stretch;
}

.demo-hero__copy,
.demo-stats {
  padding: 1.5rem 1.6rem;
  border: 1px solid var(--playground-border);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--playground-shadow);
  backdrop-filter: blur(18px) saturate(1.2);
}

.demo-hero__eyebrow,
.demo-stage-shell__eyebrow {
  margin: 0 0 0.5rem;
  color: var(--playground-accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.demo-hero h1,
.demo-stage-shell h2 {
  margin: 0;
  color: var(--playground-title);
  line-height: 1.04;
}

.demo-hero h1 {
  max-width: 15ch;
  font-size: clamp(2.2rem, 5vw, 4.1rem);
}

.demo-stage-shell h2 {
  font-size: 1.15rem;
}

.demo-hero__lede {
  max-width: 58ch;
  margin: 1rem 0 0;
  color: var(--playground-copy);
  font-size: 1rem;
  line-height: 1.65;
}

.demo-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.demo-stats__card {
  padding: 1rem;
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.9));
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.demo-stats__card dt {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.demo-stats__card dd {
  margin: 0.5rem 0 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: #0f172a;
}

.demo-stage-shell {
  display: grid;
  gap: 1rem;
}

.demo-stage-shell__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.demo-stage-shell__status {
  max-width: 36ch;
  margin: 0;
  color: #475569;
  text-align: right;
  line-height: 1.55;
}

.demo-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(18rem, 24rem);
  gap: 1rem;
}

.demo-board-shell {
  position: relative;
  min-height: 44rem;
  padding: 1rem;
  border: 1px solid var(--playground-border);
  border-radius: 30px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.58)),
    rgba(248, 250, 252, 0.86);
  box-shadow: var(--playground-shadow);
}

.demo-board {
  position: relative;
  min-height: 42rem;
  border-radius: 22px;
  overflow: hidden;
}

.demo-diagnostics {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 10;
  max-width: min(34rem, calc(100% - 2rem));
}

.demo-minimap {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
  padding: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 38px -28px rgba(15, 23, 42, 0.52);
  color: #475569;
}

:deep(.demo-board.board-root) {
  --board-bg: #f8fafc;
  --board-fg: #0f172a;
  --board-node-bg: #ffffff;
  --board-node-border: rgba(15, 23, 42, 0.08);
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 32%),
    linear-gradient(180deg, #f8fafc, #eef5f8);
}

:deep(.demo-board .board-node) {
  border-radius: 18px;
  border-color: rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 12px 30px -24px rgba(15, 23, 42, 0.35);
}

:deep(.demo-board .board-node.is-selected) {
  outline: 2px solid rgba(15, 118, 110, 0.8);
  outline-offset: -1px;
  box-shadow:
    0 0 0 6px rgba(15, 118, 110, 0.08),
    0 18px 36px -26px rgba(15, 23, 42, 0.42);
}

:deep(.demo-board .board-node__content),
:deep(.demo-board .board-node__editor) {
  font-family: var(--playground-sans);
  font-size: 0.96rem;
  line-height: 1.55;
  color: #0f172a;
}

:deep(.demo-board .board-node__content) {
  display: flex;
  align-items: center;
  white-space: pre-wrap;
}

:deep(.demo-board .board-connection-layer) {
  color: rgba(14, 116, 144, 0.44);
}

:deep(.demo-board .board-node-handle) {
  border-radius: 4px;
  border-color: rgba(15, 118, 110, 0.86);
  background: white;
}

@media (max-width: 1100px) {
  .demo-hero,
  .demo-stage-grid {
    grid-template-columns: 1fr;
  }

  .demo-stage-shell__header {
    flex-direction: column;
    align-items: start;
  }

  .demo-stage-shell__status {
    text-align: left;
  }
}

@media (max-width: 720px) {
  .demo-shell {
    padding: 1rem;
  }

  .demo-stats {
    grid-template-columns: 1fr 1fr;
  }

  .demo-board-shell {
    min-height: 34rem;
    padding: 0.75rem;
  }

  .demo-board {
    min-height: 32rem;
  }

  .demo-minimap {
    display: none;
  }
}
</style>
