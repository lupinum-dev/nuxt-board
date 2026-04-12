<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createCanvasEngine } from '@canvas/core'
import { CanvasRoot } from '@canvas/vue'

const engine = createCanvasEngine({
  diagnostics: true,
  traceLimit: 500
})

const benchmarkResult = ref('idle')
const selectedScene = ref<100 | 500 | 1000>(100)

function seedScene(count: number): void {
  const snapshot = engine.getSnapshot()
  if (snapshot.nodes.length > 0) {
    engine.select(snapshot.nodes.map((node) => node.id))
    engine.deleteSelected()
  }

  const columns = Math.ceil(Math.sqrt(count))
  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    engine.createNode({
      x: column * 320,
      y: row * 220,
      width: 260,
      height: 160,
      text: `Card ${index + 1}\nGrid ${column}, ${row}`
    })
  }
  engine.clearSelection()
}

async function runBenchmark(): Promise<void> {
  benchmarkResult.value = 'running'
  const samples: number[] = []
  const start = performance.now()

  for (let step = 0; step < 80; step += 1) {
    const frameStart = performance.now()
    engine.panByScreenDelta(step % 2 === 0 ? 18 : -14, 12)
    engine.zoomAtScreenPoint({ x: 480, y: 320 }, step % 2 === 0 ? 0.4 : -0.32)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(performance.now() - frameStart)
  }

  const total = performance.now() - start
  const maxFrame = Math.max(...samples)
  const averageFrame = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  benchmarkResult.value = `total ${total.toFixed(1)}ms, avg ${averageFrame.toFixed(2)}ms, max ${maxFrame.toFixed(2)}ms`
}

onMounted(() => {
  seedScene(selectedScene.value)
  ;(window as Window & { __canvasPlayground?: Record<string, unknown> }).__canvasPlayground = {
    engine,
    seedScene,
    runBenchmark
  }
})
</script>

<template>
  <main class="playground-shell">
    <aside class="playground-panel">
      <div>
        <p class="eyebrow">Canvas Library</p>
        <h1>Infinite Board Playground</h1>
        <p class="lede">
          The playground exercises the public engine and Vue adapter directly. Use the controls below or interact with the board.
        </p>
      </div>

      <label class="control">
        <span>Scene size</span>
        <select v-model="selectedScene">
          <option :value="100">100 cards</option>
          <option :value="500">500 cards</option>
          <option :value="1000">1000 cards</option>
        </select>
      </label>

      <div class="button-row">
        <button type="button" @click="seedScene(selectedScene)">Seed Scene</button>
        <button type="button" @click="runBenchmark">Run Benchmark</button>
      </div>

      <p class="benchmark">Benchmark: {{ benchmarkResult }}</p>
      <ul class="notes">
        <li>Double-click empty space to create a card.</li>
        <li>Double-click a card to edit text.</li>
        <li>Drag background to pan. Pinch or Ctrl/Cmd+wheel to zoom.</li>
      </ul>
    </aside>

    <section class="playground-canvas">
      <CanvasRoot :engine="engine" debug>
        <template #default="{ debugState }">
          <aside class="debug-overlay">
            <h2>Diagnostics</h2>
            <dl>
              <div>
                <dt>Camera</dt>
                <dd>{{ debugState.camera.x.toFixed(1) }}, {{ debugState.camera.y.toFixed(1) }}, {{ debugState.camera.z.toFixed(2) }}</dd>
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
                <dt>Renders</dt>
                <dd>{{ debugState.renderCount }}</dd>
              </div>
              <div>
                <dt>Last Sample</dt>
                <dd>
                  <template v-if="debugState.lastPerformanceSample">
                    {{ debugState.lastPerformanceSample.command }} {{ debugState.lastPerformanceSample.durationMs.toFixed(2) }}ms
                  </template>
                  <template v-else>none</template>
                </dd>
              </div>
              <div>
                <dt>Invariant</dt>
                <dd>{{ debugState.lastInvariantFailure ?? 'ok' }}</dd>
              </div>
            </dl>
            <details>
              <summary>Recent events</summary>
              <pre>{{ JSON.stringify(debugState.recentEvents, null, 2) }}</pre>
            </details>
          </aside>
        </template>
      </CanvasRoot>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  color: #0f172a;
  background: #e2e8f0;
  font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

.playground-shell {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  min-height: 100vh;
}

.playground-panel {
  display: grid;
  gap: 24px;
  padding: 32px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.86)),
    linear-gradient(135deg, rgba(14, 165, 233, 0.1), transparent 42%);
  border-right: 1px solid rgba(15, 23, 42, 0.08);
}

.eyebrow {
  margin: 0 0 8px;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 40px;
  line-height: 0.95;
}

.lede,
.benchmark,
.notes {
  margin: 0;
  color: #334155;
  line-height: 1.55;
}

.control {
  display: grid;
  gap: 8px;
}

.control select,
.button-row button {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  color: #0f172a;
  font: inherit;
}

.control select {
  padding: 12px 14px;
}

.button-row {
  display: flex;
  gap: 12px;
}

.button-row button {
  padding: 12px 14px;
  cursor: pointer;
}

.notes {
  padding-left: 18px;
}

.playground-canvas {
  position: relative;
  min-height: 100vh;
}

.debug-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  width: min(360px, calc(100% - 40px));
  max-height: calc(100% - 40px);
  padding: 16px;
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  pointer-events: none;
}

.debug-overlay h2,
.debug-overlay summary {
  margin: 0 0 12px;
}

.debug-overlay dl {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
}

.debug-overlay dl div {
  display: grid;
  gap: 4px;
}

.debug-overlay dt {
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.debug-overlay dd {
  margin: 0;
  color: #0f172a;
}

.debug-overlay pre {
  margin: 12px 0 0;
  white-space: pre-wrap;
  font-size: 12px;
}

@media (max-width: 960px) {
  .playground-shell {
    grid-template-columns: 1fr;
  }

  .playground-canvas {
    min-height: 70vh;
  }
}
</style>
