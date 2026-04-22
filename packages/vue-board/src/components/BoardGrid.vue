<script setup lang="ts">
import { computed } from 'vue'
import { useBoardEngine, useGridStyle } from '../useBoardEngine'

const { resolvedGrid } = useBoardEngine()
const style = useGridStyle()

const backgroundImage = computed(() => {
  switch (resolvedGrid.value.pattern) {
    case 'dot':
      return [
        'radial-gradient(circle, var(--grid-major-color) 1px, transparent 1px)',
        'radial-gradient(circle, var(--grid-minor-color) 1px, transparent 1px)',
      ].join(', ')
    case 'cross':
      return [
        'linear-gradient(to right, var(--grid-major-color) 1px, transparent 1px)',
        'linear-gradient(to bottom, var(--grid-major-color) 1px, transparent 1px)',
        'linear-gradient(to right, var(--grid-minor-color) 1px, transparent 1px)',
        'linear-gradient(to bottom, var(--grid-minor-color) 1px, transparent 1px)',
      ].join(', ')
    case 'none':
      return 'none'
    default:
      return [
        'linear-gradient(to right, var(--grid-minor-color) 1px, transparent 1px)',
        'linear-gradient(to bottom, var(--grid-minor-color) 1px, transparent 1px)',
        'linear-gradient(to right, var(--grid-major-color) 1px, transparent 1px)',
        'linear-gradient(to bottom, var(--grid-major-color) 1px, transparent 1px)',
      ].join(', ')
  }
})

const backgroundSize = computed(() => {
  if (resolvedGrid.value.pattern === 'dot') {
    return [
      'var(--grid-major-size) var(--grid-major-size)',
      'var(--grid-minor-size) var(--grid-minor-size)',
    ].join(', ')
  }
  return [
    'var(--grid-minor-size) var(--grid-minor-size)',
    'var(--grid-minor-size) var(--grid-minor-size)',
    'var(--grid-major-size) var(--grid-major-size)',
    'var(--grid-major-size) var(--grid-major-size)',
  ].join(', ')
})

const backgroundPosition = computed(() => {
  if (resolvedGrid.value.pattern === 'dot') {
    return [
      'var(--grid-major-x) var(--grid-major-y)',
      'var(--grid-minor-x) var(--grid-minor-y)',
    ].join(', ')
  }
  return [
    'var(--grid-minor-x) var(--grid-minor-y)',
    'var(--grid-minor-x) var(--grid-minor-y)',
    'var(--grid-major-x) var(--grid-major-y)',
    'var(--grid-major-x) var(--grid-major-y)',
  ].join(', ')
})
</script>

<template>
  <div
    v-if="resolvedGrid.visible && resolvedGrid.pattern !== 'none'"
    class="board-grid"
    :style="{
      ...style,
      backgroundImage,
      backgroundSize,
      backgroundPosition,
    }"
  />
</template>

<style scoped>
.board-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mask-image: var(--grid-mask-image);
}
</style>
