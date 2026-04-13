<script setup lang="ts">
import type { GridPattern } from '@canvas/core'

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
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__block">
      <p class="sidebar__eyebrow">Active Scene</p>
      <h2 class="sidebar__title">{{ sceneLabel }}</h2>
      <p class="sidebar__copy">{{ sceneSummary }}</p>
    </div>

    <div class="sidebar__block">
      <p class="sidebar__eyebrow">Grid</p>
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

    <div class="sidebar__block">
      <p class="sidebar__eyebrow">JSON Canvas</p>
      <textarea
        v-model="documentText"
        class="sidebar__textarea"
        spellcheck="false"
        placeholder="Export the current board, tweak it, then import it back."
      />
      <div class="sidebar__footer">
        <button class="sidebar__button" @click="emit('import')">Import JSON</button>
        <span class="sidebar__status">{{ status }}</span>
      </div>
    </div>

    <div class="sidebar__block">
      <p class="sidebar__eyebrow">Benchmark</p>
      <p class="sidebar__copy sidebar__copy--mono">{{ benchmarkResult }}</p>
    </div>

    <div class="sidebar__block">
      <p class="sidebar__eyebrow">Shortcuts</p>
      <ul class="sidebar__list">
        <li>Double-click the board to create a text node.</li>
        <li>Use <kbd>Space</kbd> + drag to pan.</li>
        <li>Use <kbd>Ctrl/Cmd</kbd> + <kbd>1</kbd> to zoom-to-fit.</li>
        <li>Use arrows to nudge the current selection.</li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  gap: 1rem;
  padding: 1.15rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.94));
  box-shadow: 0 20px 50px -34px rgba(15, 23, 42, 0.42);
}

.sidebar__block {
  display: grid;
  gap: 0.6rem;
}

.sidebar__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0f766e;
}

.sidebar__title {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.2;
  color: #0f172a;
}

.sidebar__copy {
  margin: 0;
  color: #475569;
  line-height: 1.5;
}

.sidebar__copy--mono {
  font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
  font-size: 0.82rem;
}

.sidebar__field {
  display: grid;
  gap: 0.35rem;
  color: #334155;
  font-size: 0.86rem;
  font-weight: 600;
}

.sidebar__select,
.sidebar__textarea,
.sidebar__button {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  font: inherit;
}

.sidebar__select {
  padding: 0.6rem 0.7rem;
}

.sidebar__textarea {
  min-height: 11rem;
  padding: 0.8rem 0.9rem;
  resize: vertical;
  font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
  font-size: 0.76rem;
  line-height: 1.45;
}

.sidebar__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar__button {
  padding: 0.62rem 0.9rem;
  cursor: pointer;
}

.sidebar__status {
  color: #64748b;
  font-size: 0.8rem;
}

.sidebar__list {
  margin: 0;
  padding-left: 1rem;
  color: #475569;
  line-height: 1.5;
}
</style>
