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
  export: []
  group: []
}>()
</script>

<template>
  <div class="toolbar">
    <label class="toolbar__field">
      <span class="toolbar__label">Scene</span>
      <select v-model="sceneId" class="toolbar__select">
        <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
          {{ scene.label }}
        </option>
      </select>
    </label>

    <div class="toolbar__cluster toolbar__cluster--actions">
      <button class="toolbar__button" @click="emit('reseed')">Reset</button>
      <button class="toolbar__button" @click="emit('fit')">Fit view</button>
      <button class="toolbar__button" @click="emit('group')">Group</button>
      <button class="toolbar__button" @click="emit('export')">Export</button>
    </div>

    <div class="toolbar__spacer" />

    <div class="toolbar__cluster toolbar__cluster--views">
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showGrid }"
        :aria-pressed="showGrid"
        @click="showGrid = !showGrid"
      >
        Grid
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': snapToGrid }"
        :aria-pressed="snapToGrid"
        @click="snapToGrid = !snapToGrid"
      >
        Snap
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showMinimap }"
        :aria-pressed="showMinimap"
        @click="showMinimap = !showMinimap"
      >
        Minimap
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showDiagnostics }"
        :aria-pressed="showDiagnostics"
        @click="showDiagnostics = !showDiagnostics"
      >
        Debug
      </button>
      <button
        class="toolbar__toggle"
        :class="{ 'is-active': showPanel }"
        :aria-pressed="showPanel"
        @click="showPanel = !showPanel"
      >
        Inspector
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--playground-border);
  border-radius: 0.75rem;
  background: var(--playground-surface);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.toolbar__field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-inline-start: 0.375rem;
  color: #3f3f46;
  font-size: 0.78rem;
  font-weight: 500;
}

.toolbar__select,
.toolbar__button,
.toolbar__toggle {
  min-height: 2.25rem;
  border: 1px solid var(--playground-border);
  border-radius: 0.5rem;
  background: var(--playground-surface);
  color: var(--playground-title);
  font: inherit;
}

.toolbar__select {
  min-width: 11rem;
  padding: 0.4rem 2rem 0.4rem 0.65rem;
}

.toolbar__cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.toolbar__spacer {
  flex: 1 1 auto;
}

.toolbar__button,
.toolbar__toggle {
  padding: 0.4rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.toolbar__button:hover,
.toolbar__toggle:hover {
  background: #f4f4f5;
}

.toolbar__toggle.is-active {
  border-color: #18181b;
  background: #f4f4f5;
  color: #18181b;
}

@media (max-width: 900px) {
  .toolbar {
    align-items: stretch;
  }

  .toolbar__field {
    width: 100%;
  }

  .toolbar__select {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 720px) {
  .toolbar {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.375rem;
    padding: 0.375rem;
    border-radius: 0.625rem;
  }

  .toolbar__field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    min-height: 2.5rem;
    padding-inline: 0.375rem;
  }

  .toolbar__select {
    width: 100%;
    min-width: 0;
  }

  .toolbar__cluster {
    display: grid;
    gap: 0.25rem;
  }

  .toolbar__cluster--actions {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .toolbar__cluster--views {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .toolbar__button,
  .toolbar__toggle {
    min-width: 0;
    padding-inline: 0.35rem;
    font-size: 0.76rem;
    white-space: nowrap;
  }

  .toolbar__spacer {
    display: none;
  }
}

@media (max-width: 360px) {
  .toolbar__cluster--views {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
