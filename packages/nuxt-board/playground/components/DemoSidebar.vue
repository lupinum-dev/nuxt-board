<script setup lang="ts">
import type { GridPattern } from '@lupinum/board-core'

defineProps<{
  sceneLabel: string
  sceneSummary: string
  benchmarkResult: string
  status: string
}>()

const gridSize = defineModel<number>('gridSize', { required: true })
const gridPattern = defineModel<GridPattern>('gridPattern', { required: true })
const documentText = defineModel<string>('documentText', { required: true })

const emit = defineEmits<{
  import: []
  benchmark: []
}>()
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar__header">
      <div>
        <p class="sidebar__eyebrow">Inspector</p>
        <h2 class="sidebar__title">
          {{ sceneLabel }}
        </h2>
      </div>
      <p class="sidebar__copy">
        {{ sceneSummary }}
      </p>
    </header>

    <div class="sidebar__block">
      <h3 class="sidebar__section-title">Grid</h3>
      <div class="sidebar__field-grid">
        <label class="sidebar__field">
          <span>Size</span>
          <select v-model="gridSize" class="sidebar__select">
            <option :value="16">16 px</option>
            <option :value="24">24 px</option>
            <option :value="40">40 px</option>
          </select>
        </label>
        <label class="sidebar__field">
          <span>Pattern</span>
          <select v-model="gridPattern" class="sidebar__select">
            <option value="line">Line</option>
            <option value="dot">Dot</option>
            <option value="cross">Cross</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
    </div>

    <div class="sidebar__block">
      <label class="sidebar__section-title" for="json-canvas-editor">
        JSON Canvas
      </label>
      <textarea
        id="json-canvas-editor"
        v-model="documentText"
        class="sidebar__textarea"
        spellcheck="false"
        placeholder="Export the current board, tweak it, then import it back."
      />
      <div class="sidebar__footer">
        <button class="sidebar__button" @click="emit('import')">
          Import document
        </button>
        <span class="sidebar__status">
          {{ status }}
        </span>
      </div>
    </div>

    <div class="sidebar__block">
      <h3 class="sidebar__section-title">Performance</h3>
      <p class="sidebar__copy sidebar__copy--mono">
        {{ benchmarkResult }}
      </p>
      <button
        class="sidebar__button sidebar__button--secondary"
        @click="emit('benchmark')"
      >
        Run benchmark
      </button>
    </div>

    <details class="sidebar__details">
      <summary>Keyboard shortcuts</summary>
      <ul class="sidebar__list">
        <li>Double-click the board to create a text node.</li>
        <li>Drag from a card edge to create a connection.</li>
        <li>Use <kbd>Alt/Option</kbd> + drag to duplicate the selection.</li>
        <li>Use <kbd>Shift</kbd> while dragging to lock to one axis.</li>
        <li>
          Use <kbd>Space</kbd> while dragging or resizing to bypass snapping.
        </li>
        <li>
          Use <kbd>Space</kbd> + drag to pan, or <kbd>Space</kbd> + scroll to
          zoom.
        </li>
        <li>Use <kbd>Ctrl/Cmd</kbd> + <kbd>1</kbd> to zoom-to-fit.</li>
        <li>Use arrows to nudge the current selection.</li>
      </ul>
    </details>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  align-content: start;
  gap: 0;
  overflow: auto;
  max-height: max(36rem, calc(100dvh - 12.75rem));
  border: 1px solid var(--playground-border);
  border-radius: 0.75rem;
  background: var(--playground-surface);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.sidebar__header,
.sidebar__block {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.sidebar__block,
.sidebar__details {
  border-top: 1px solid var(--playground-border);
}

.sidebar__eyebrow {
  margin: 0;
  color: var(--playground-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar__title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  color: var(--playground-title);
}

.sidebar__copy {
  margin: 0;
  color: var(--playground-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.sidebar__copy--mono {
  font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sidebar__section-title {
  margin: 0;
  color: var(--playground-title);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.3;
}

.sidebar__field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.sidebar__field {
  display: grid;
  gap: 0.35rem;
  color: #3f3f46;
  font-size: 0.75rem;
  font-weight: 500;
}

.sidebar__select,
.sidebar__textarea,
.sidebar__button {
  min-height: 2.25rem;
  border: 1px solid var(--playground-border);
  border-radius: 0.5rem;
  background: var(--playground-surface);
  color: var(--playground-title);
  font: inherit;
}

.sidebar__select {
  padding: 0.4rem 0.6rem;
}

.sidebar__textarea {
  min-height: 8rem;
  padding: 0.65rem;
  resize: vertical;
  font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
}

.sidebar__footer {
  display: grid;
  gap: 0.5rem;
}

.sidebar__button {
  width: fit-content;
  padding: 0.5rem 0.75rem;
  background: #18181b;
  color: #fafafa;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}

.sidebar__button--secondary {
  background: var(--playground-surface);
  color: var(--playground-title);
}

.sidebar__button:hover {
  opacity: 0.88;
}

.sidebar__status {
  color: var(--playground-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.sidebar__details {
  padding: 0.875rem 1rem 1rem;
}

.sidebar__details summary {
  cursor: pointer;
  color: var(--playground-title);
  font-size: 0.8rem;
  font-weight: 600;
}

.sidebar__list {
  margin: 0.75rem 0 0;
  padding-inline-start: 1rem;
  color: var(--playground-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .sidebar {
    max-height: none;
  }
}

@media (max-width: 720px) {
  .sidebar__select,
  .sidebar__textarea,
  .sidebar__button {
    font-size: 1rem;
  }
}
</style>
