<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasEngine } from '../useCanvasEngine'

const { snapshot } = useCanvasEngine()

const screenGuides = computed(() => {
  const guides = snapshot.value.snapGuides
  if (!guides || guides.length === 0) return []
  const { x: cx, y: cy, z } = snapshot.value.camera
  return guides.map((guide) => {
    if (guide.axis === 'x') {
      return {
        axis: 'x' as const,
        pos: (guide.position + cx) * z,
        from: (guide.from + cy) * z,
        to: (guide.to + cy) * z
      }
    } else {
      return {
        axis: 'y' as const,
        pos: (guide.position + cy) * z,
        from: (guide.from + cx) * z,
        to: (guide.to + cx) * z
      }
    }
  })
})
</script>

<template>
  <div v-if="screenGuides.length > 0" class="canvas-snap-guides">
    <div
      v-for="(guide, index) in screenGuides"
      :key="index"
      class="canvas-snap-guide"
      :class="guide.axis === 'x' ? 'canvas-snap-guide--vertical' : 'canvas-snap-guide--horizontal'"
      :style="guide.axis === 'x'
        ? { left: guide.pos + 'px', top: guide.from + 'px', height: (guide.to - guide.from) + 'px' }
        : { top: guide.pos + 'px', left: guide.from + 'px', width: (guide.to - guide.from) + 'px' }
      "
    />
  </div>
</template>

<style scoped>
.canvas-snap-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 999999;
}

.canvas-snap-guide {
  position: absolute;
}

.canvas-snap-guide--vertical {
  width: 1px;
  background: #3b82f6;
}

.canvas-snap-guide--horizontal {
  height: 1px;
  background: #3b82f6;
}
</style>
