<script setup lang="ts">
import type { DemoSceneId, DemoSceneOption } from '~/lib/demo'

defineProps<{
  scenes: DemoSceneOption[]
}>()

const sceneId = defineModel<DemoSceneId>('sceneId', { required: true })
const showGrid = defineModel<boolean>('showGrid', { required: true })
const snapToGrid = defineModel<boolean>('snapToGrid', { required: true })
const showMinimap = defineModel<boolean>('showMinimap', { required: true })
const showDiagnostics = defineModel<boolean>('showDiagnostics', {
  required: true,
})
const showPanel = defineModel<boolean>('showPanel', { required: true })

const emit = defineEmits<{
  reseed: []
  fit: []
  benchmark: []
  export: []
  group: []
}>()
</script>

<template>
  <div class="toolbar">
    <label class="toolbar__field">
      <span>Scene</span>
      <select v-model="sceneId" class="toolbar__select">
        <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
          {{ scene.label }}
        </option>
      </select>
    </label>

    <div class="toolbar__cluster">
      <button class="toolbar__button" @click="emit('reseed')">Reset</button>
      <button class="toolbar__button" @click="emit('fit')">Fit</button>
      <button class="toolbar__button" @click="emit('group')">Group</button>
      <button class="toolbar__button" @click="emit('benchmark')">
        Benchmark
      </button>
      <button class="toolbar__button" @click="emit('export')">Export</button>
    </div>

    <div class="toolbar__cluster">
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showGrid }"
        @click="showGrid = !showGrid"
      >
        Grid
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': snapToGrid }"
        @click="snapToGrid = !snapToGrid"
      >
        Snap
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showMinimap }"
        @click="showMinimap = !showMinimap"
      >
        Minimap
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showDiagnostics }"
        @click="showDiagnostics = !showDiagnostics"
      >
        Diag
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showPanel }"
        @click="showPanel = !showPanel"
      >
        Panel
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(1.25);
  box-shadow: 0 16px 40px -28px rgba(15, 23, 42, 0.42);
}

.toolbar__field {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: #334155;
}

.toolbar__select,
.toolbar__button,
.toolbar__toggle {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.94);
  color: #0f172a;
  font: inherit;
}

.toolbar__select {
  min-width: 12rem;
  padding: 0.55rem 0.8rem;
}

.toolbar__cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.toolbar__button,
.toolbar__toggle {
  padding: 0.55rem 0.85rem;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.toolbar__button:hover,
.toolbar__toggle:hover {
  border-color: rgba(14, 116, 144, 0.35);
  background: #ffffff;
  transform: translateY(-1px);
}

.toolbar__toggle.is-active {
  border-color: rgba(15, 118, 110, 0.32);
  background: #0f766e;
  color: #f8fafc;
}

@media (max-width: 900px) {
  .toolbar {
    padding: 0.8rem;
  }

  .toolbar__select {
    min-width: 100%;
  }
}
</style>
