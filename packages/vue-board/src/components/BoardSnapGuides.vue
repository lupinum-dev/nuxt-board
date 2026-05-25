<script setup lang="ts">
import { computed } from 'vue'
import { useBoardEngine } from '../useBoardEngine.js'

const { $camera, $snapGuides } = useBoardEngine()

const screenGuides = computed(() => {
  const guides = $snapGuides.value
  if (!guides || guides.length === 0) return []
  const { x: cx, y: cy, z } = $camera.value
  return guides.map((guide) => {
    if (guide.axis === 'x') {
      return {
        axis: 'x' as const,
        pos: (guide.position + cx) * z,
        from: (guide.from + cy) * z,
        to: (guide.to + cy) * z,
      }
    } else {
      return {
        axis: 'y' as const,
        pos: (guide.position + cy) * z,
        from: (guide.from + cx) * z,
        to: (guide.to + cx) * z,
      }
    }
  })
})
</script>

<template>
  <div v-if="screenGuides.length > 0" class="board-snap-guides">
    <div
      v-for="(guide, index) in screenGuides"
      :key="index"
      class="board-snap-guide"
      :class="
        guide.axis === 'x'
          ? 'board-snap-guide--vertical'
          : 'board-snap-guide--horizontal'
      "
      :style="
        guide.axis === 'x'
          ? {
              left: guide.pos + 'px',
              top: guide.from + 'px',
              height: guide.to - guide.from + 'px',
            }
          : {
              top: guide.pos + 'px',
              left: guide.from + 'px',
              width: guide.to - guide.from + 'px',
            }
      "
    />
  </div>
</template>

<style scoped>
.board-snap-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 999999;
  color: var(--board-snap-guide-color, var(--board-accent, #6366e8));
}

.board-snap-guide {
  position: absolute;
  background: currentColor;
  opacity: 0.95;
  animation: board-snap-guide-in 120ms var(--board-ease-out, ease);
}

.board-snap-guide--vertical {
  width: 1px;
  transform: translateX(-0.5px);
}

.board-snap-guide--horizontal {
  height: 1px;
  transform: translateY(-0.5px);
}

/* Crisp tick caps at each end, like Figma's alignment hints. */
.board-snap-guide::before,
.board-snap-guide::after {
  content: '';
  position: absolute;
  background: currentColor;
}

.board-snap-guide--vertical::before,
.board-snap-guide--vertical::after {
  left: -3px;
  width: 7px;
  height: 1px;
}

.board-snap-guide--vertical::before {
  top: -0.5px;
}

.board-snap-guide--vertical::after {
  bottom: -0.5px;
}

.board-snap-guide--horizontal::before,
.board-snap-guide--horizontal::after {
  top: -3px;
  width: 1px;
  height: 7px;
}

.board-snap-guide--horizontal::before {
  left: -0.5px;
}

.board-snap-guide--horizontal::after {
  right: -0.5px;
}

@keyframes board-snap-guide-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.95;
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-snap-guide {
    animation: none;
  }
}
</style>
