<script setup lang="ts">
import { computed } from 'vue'
import { useBoxSelectBounds } from '../useBoardEngine'

const bounds = useBoxSelectBounds()

const style = computed(() => {
  if (!bounds.value) {
    return {}
  }
  return {
    left: `${bounds.value.minX}px`,
    top: `${bounds.value.minY}px`,
    width: `${bounds.value.maxX - bounds.value.minX}px`,
    height: `${bounds.value.maxY - bounds.value.minY}px`
  }
})
</script>

<template>
  <slot v-if="bounds" :bounds="bounds">
    <div v-if="bounds" class="board-box-select" :style="style" />
  </slot>
</template>

<style scoped>
.board-box-select {
  position: absolute;
  border: 1.5px solid var(--board-box-select-stroke, rgba(15, 118, 110, 0.64));
  border-radius: 6px;
  background: var(--board-box-select-fill, rgba(15, 118, 110, 0.1));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  pointer-events: none;
}
</style>
