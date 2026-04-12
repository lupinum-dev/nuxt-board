<script setup lang="ts">
import { computed } from 'vue'
import type { CanvasNode } from '@canvas/core'

const props = defineProps<{
  node: CanvasNode
  selected: boolean
}>()

type GroupData = { title?: string; accent?: string }

const data = computed((): GroupData => (props.node.data ?? {}) as GroupData)

const title = computed(() => (typeof data.value.title === 'string' ? data.value.title : 'Untitled group'))

const accent = computed(() =>
  typeof data.value.accent === 'string' && data.value.accent.length > 0 ? data.value.accent : '#0d9488'
)
</script>

<template>
  <div
    class="group-node"
    :style="{
      '--accent': accent,
      '--accent-border': accent + '66',
      '--accent-glow': accent + '22'
    } as any"
    :class="{ 'is-selected': selected }"
  >
    <div class="group-node__label">
      <span class="group-node__title">{{ title }}</span>
    </div>
  </div>
</template>

<style scoped>
.group-node {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: visible;
  border: 2px solid var(--accent-border);
  background: transparent;
}

.group-node.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.group-node__label {
  position: absolute;
  left: 8px;
  bottom: calc(100% + 4px);
  max-width: calc(100% - 16px);
  pointer-events: none;
  transform: scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: left bottom;
}

.group-node__title {
  display: inline-block;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
