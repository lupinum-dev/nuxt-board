<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GridPattern } from '@lupinum/board-core'
import { BoardConnectionLayer } from '../../board-connections/src/vue'
import { BoardHistoryShortcuts } from '../../board-history/src/vue'
import { BoardMinimap } from '../../vue-board/src/minimap'
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
  title: 'nuxt-board playground',
  meta: [
    {
      name: 'description',
      content:
        'A Nuxt SSR demo for nuxt-board with deterministic seeded scenes, plugins, minimap, and JSON import/export.',
    },
  ],
})

const defaultSceneId: DemoSceneId = 'workflow'
const seeded = createDemoEngine(defaultSceneId)
const engine = seeded.engine

const sceneId = ref<DemoSceneId>(defaultSceneId)
const activeScene = ref<DemoSceneOption>(seeded.scene)
const showGrid = ref(true)
const showMinimap = ref(false)
const showDiagnostics = ref(false)
const showPanel = ref(false)
const benchmarkResult = ref('idle')
const documentText = ref('')
const status = ref('Scene seeded from deterministic data for SSR hydration.')
const version = ref(0)

const snapToGrid = computed({
  get: () => {
    void version.value
    return engine.getGridSettings().snap
  },
  set: (snap: boolean) => engine.updateGridSettings({ snap }),
})
const gridSize = computed({
  get: () => {
    void version.value
    return engine.getGridSettings().size
  },
  set: (size: number) => engine.updateGridSettings({ size }),
})
const gridPattern = computed({
  get: () => {
    void version.value
    return engine.getGridSettings().pattern
  },
  set: (pattern: GridPattern) => engine.updateGridSettings({ pattern }),
})

const renderers: BoardRendererRegistry = {
  file: DemoImageNodeRenderer,
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

const stats = ref(getDemoCounts(engine))

onMounted(() => {
  if (window.matchMedia('(min-width: 901px)').matches) {
    void nextTick(() => engine.zoomToFit(64, false))
    return
  }

  if (window.matchMedia('(min-width: 721px)').matches) {
    void nextTick(() => engine.zoomToFit(48, false))
    return
  }

  if (window.matchMedia('(max-width: 720px)').matches) {
    engine.zoomTo(0.7)
    engine.panBy(0, -88)
  }
})

watch(showPanel, async () => {
  if (
    typeof window === 'undefined' ||
    !window.matchMedia('(min-width: 901px)').matches
  ) {
    return
  }

  await nextTick()
  await engine.zoomToFit(64, false)
})

const gridOptions = computed(() => ({
  visible: showGrid.value,
}))

function reseedScene(): void {
  activeScene.value = loadDemoScene(engine, sceneId.value)
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

watch(
  version,
  () => {
    stats.value = getDemoCounts(engine)
  },
  { immediate: true },
)

function exportDocument(): void {
  documentText.value = exportDemoDocument(engine)
  status.value = 'Exported current board as JSON Canvas.'
}

function loadDocument(): void {
  if (!documentText.value.trim()) {
    status.value = 'Nothing to import yet.'
    return
  }
  try {
    importDemoDocument(engine, documentText.value)
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
  const average =
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms · avg ${average.toFixed(2)}ms · max ${Math.max(...samples).toFixed(2)}ms`
  status.value = 'Benchmark finished on the current scene.'
}

function fitScene(): void {
  void engine.zoomToFit(80, true)
}

function groupSelection(): void {
  const result = wrapSelectionInGroup(engine)
  status.value =
    result === 'grouped'
      ? 'Grouped the current selection.'
      : 'Created a new empty group.'
  version.value += 1
}
</script>

<template>
  <main class="demo-shell">
    <header class="demo-header">
      <div class="demo-brand">
        <span class="demo-brand__mark" aria-hidden="true">N</span>
        <div>
          <h1>Nuxt Board</h1>
          <p>SSR playground</p>
        </div>
      </div>

      <dl class="demo-summary" aria-label="Board summary">
        <div>
          <dt>Nodes</dt>
          <dd>{{ stats.nodes }}</dd>
        </div>
        <div>
          <dt>Edges</dt>
          <dd>{{ stats.edges }}</dd>
        </div>
        <div>
          <dt>Undo</dt>
          <dd>{{ stats.history }}</dd>
        </div>
        <div class="demo-summary__status">
          <dt>Rendering</dt>
          <dd><span aria-hidden="true"></span> SSR ready</dd>
        </div>
      </dl>
    </header>

    <section class="demo-workspace" aria-labelledby="workspace-title">
      <div class="demo-workspace__header">
        <div>
          <h2 id="workspace-title">{{ activeScene.label }}</h2>
          <p>{{ activeScene.summary }}</p>
        </div>
        <p class="demo-workspace__status" role="status" aria-live="polite">
          {{ status }}
        </p>
      </div>

      <DemoToolbar
        v-model:scene-id="sceneId"
        v-model:show-grid="showGrid"
        v-model:snap-to-grid="snapToGrid"
        v-model:show-minimap="showMinimap"
        v-model:show-diagnostics="showDiagnostics"
        v-model:show-panel="showPanel"
        :scenes="DEMO_SCENES"
        @export="exportDocument"
        @fit="fitScene"
        @group="groupSelection"
        @reseed="reseedScene"
      />

      <div class="demo-stage-grid" :class="{ 'has-inspector': showPanel }">
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
              <BoardHistoryShortcuts :history="engine.plugins.history" />

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
          @benchmark="runBenchmark"
          @import="loadDocument"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.demo-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  background: var(--playground-bg);
}

.demo-header {
  display: flex;
  min-height: 3.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--playground-border);
  background: var(--playground-surface);
}

.demo-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.demo-brand__mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.5rem;
  background: #18181b;
  color: #fafafa;
  font-size: 0.8rem;
  font-weight: 700;
}

.demo-brand h1,
.demo-brand p {
  margin: 0;
}

.demo-brand h1 {
  font-size: 0.95rem;
  line-height: 1.25;
}

.demo-brand p {
  color: var(--playground-muted);
  font-size: 0.75rem;
  line-height: 1.25;
}

.demo-summary {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin: 0;
}

.demo-summary > div {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.35rem;
  align-items: baseline;
}

.demo-summary dt {
  color: var(--playground-muted);
  font-size: 0.72rem;
}

.demo-summary dd {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.demo-summary__status dd {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.demo-summary__status dd span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #22c55e;
}

.demo-workspace {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-width: 0;
  padding: 1rem;
}

.demo-workspace__header {
  display: flex;
  min-height: 2.5rem;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.demo-workspace__header h2,
.demo-workspace__header p {
  margin: 0;
}

.demo-workspace__header h2 {
  font-size: 1rem;
  line-height: 1.3;
}

.demo-workspace__header > div p,
.demo-workspace__status {
  color: var(--playground-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.demo-workspace__status {
  max-width: 44ch;
  text-align: end;
}

.demo-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  min-width: 0;
}

.demo-stage-grid.has-inspector {
  grid-template-columns: minmax(0, 1fr) 20rem;
}

.demo-board-shell {
  position: relative;
  height: max(36rem, calc(100dvh - 13.25rem));
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--playground-border);
  border-radius: 0.75rem;
  background: var(--playground-surface);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.demo-board {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.demo-diagnostics {
  position: absolute;
  inset-inline-start: 0.75rem;
  bottom: 0.75rem;
  z-index: 10;
  max-width: min(32rem, calc(100% - 1.5rem));
}

.demo-minimap {
  position: absolute;
  top: 0.75rem;
  inset-inline-end: 0.75rem;
  z-index: 10;
  padding: 0.375rem;
  border: 1px solid var(--playground-border);
  border-radius: 0.625rem;
  background: rgb(255 255 255 / 0.96);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
  color: #52525b;
}

:deep(.demo-board.board-root) {
  --board-bg: #fafafa;
  --board-fg: #18181b;
  --board-node-bg: #ffffff;
  --board-node-border: #e4e4e7;
  background: #fafafa;
}

:deep(.demo-board .board-node) {
  border-radius: 0.5rem;
  border-color: #e4e4e7;
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}

:deep(.demo-board .board-node.is-selected) {
  outline: 2px solid #18181b;
  outline-offset: -1px;
  box-shadow: 0 0 0 3px rgb(24 24 27 / 0.12);
}

:deep(.demo-board .board-node__content),
:deep(.demo-board .board-node__editor) {
  font-family: var(--playground-sans);
  font-size: 0.9rem;
  line-height: 1.5;
  color: #18181b;
}

:deep(.demo-board .board-node__content) {
  display: flex;
  align-items: center;
  white-space: pre-wrap;
}

:deep(.demo-board .board-connection-layer) {
  color: rgb(82 82 91 / 0.5);
}

:deep(.demo-board .board-node-handle) {
  border-radius: 4px;
  border-color: #52525b;
  background: white;
}

@media (max-width: 900px) {
  .demo-stage-grid.has-inspector {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .demo-header {
    min-height: 3.5rem;
    padding-inline: 0.75rem;
  }

  .demo-summary > div:not(.demo-summary__status) {
    display: none;
  }

  .demo-summary__status dt {
    display: none;
  }

  .demo-workspace {
    gap: 0.625rem;
    padding: 0.75rem;
  }

  .demo-workspace__header {
    align-items: start;
  }

  .demo-workspace__header > div p {
    display: none;
  }

  .demo-workspace__status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .demo-board-shell {
    height: max(32rem, calc(100dvh - 17.5rem));
    min-height: 32rem;
    border-radius: 0.625rem;
  }

  .demo-minimap {
    display: none;
  }

  .demo-diagnostics {
    inset-inline-end: 0.75rem;
    bottom: 0.75rem;
    left: 0.75rem;
    max-width: none;
  }
}
</style>
