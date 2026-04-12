<script setup lang="ts">
import { computed } from 'vue'
import { useCamera } from '../useCanvasEngine'

const camera = useCamera()

const style = computed(() => ({
  transform: `scale(${camera.value.z}) translate(${camera.value.x}px, ${camera.value.y}px)`
}))
</script>

<template>
  <div class="canvas-viewport" :style="style">
    <slot />
  </div>
</template>

<style scoped>
.canvas-viewport {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}
</style>
