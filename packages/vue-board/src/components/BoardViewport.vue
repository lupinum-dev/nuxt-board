<script setup lang="ts">
import { computed } from 'vue'
import { useCamera } from '../useBoardEngine'

const camera = useCamera()

const style = computed(() => ({
  transform: `scale(${camera.value.z}) translate(${camera.value.x}px, ${camera.value.y}px)`,
  '--board-zoom': camera.value.z,
}))
</script>

<template>
  <div class="board-viewport" :style="style">
    <slot />
  </div>
</template>

<style scoped>
.board-viewport {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}
</style>
