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
  border: 1px dashed currentColor;
  background: rgba(15, 23, 42, 0.04);
  pointer-events: none;
}
</style>
