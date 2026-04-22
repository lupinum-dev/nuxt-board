<script setup lang="ts">
import { computed } from 'vue'
import { useBoxSelectBounds, useInteraction } from '../useBoardEngine'

const bounds = useBoxSelectBounds()
const interaction = useInteraction()

const selectionMode = computed(() => {
  if (interaction.value.mode !== 'box-select') {
    return 'window'
  }
  return interaction.value.selectionMode
})

const style = computed(() => {
  if (!bounds.value) {
    return {}
  }
  return {
    left: `${bounds.value.minX}px`,
    top: `${bounds.value.minY}px`,
    width: `${bounds.value.maxX - bounds.value.minX}px`,
    height: `${bounds.value.maxY - bounds.value.minY}px`,
  }
})
</script>

<template>
  <slot v-if="bounds" :bounds="bounds" :mode="selectionMode">
    <div
      v-if="bounds"
      class="board-box-select"
      :class="`board-box-select--${selectionMode}`"
      :data-mode="selectionMode"
      :style="style"
    />
  </slot>
</template>

<style scoped>
.board-box-select {
  position: absolute;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  pointer-events: none;
}

.board-box-select--window {
  border: 1.5px solid
    var(--board-box-select-window-stroke, rgba(37, 99, 235, 0.72));
  background: var(--board-box-select-window-fill, rgba(37, 99, 235, 0.1));
}

.board-box-select--crossing {
  border: 1.5px dashed
    var(--board-box-select-crossing-stroke, rgba(15, 118, 110, 0.8));
  background: var(--board-box-select-crossing-fill, rgba(15, 118, 110, 0.12));
}
</style>
