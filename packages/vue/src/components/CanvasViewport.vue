<script setup lang="ts">
import { computed, watch } from 'vue'
import { getVisibleBounds } from '@canvas/core'
import { useCanvasEngine } from '../useCanvasEngine'
import CanvasNodeCard from './CanvasNodeCard.vue'

const props = withDefaults(
  defineProps<{
    cullMargin?: number
  }>(),
  {
    cullMargin: 200
  }
)

const { snapshot, viewportSize, renderStats } = useCanvasEngine()

const viewportStyle = computed(() => ({
  transform: `scale(${snapshot.value.camera.z}) translate(${snapshot.value.camera.x}px, ${snapshot.value.camera.y}px)`
}))

const visibleNodes = computed(() => {
  const bounds = getVisibleBounds(viewportSize.value.x, viewportSize.value.y, snapshot.value.camera)
  return snapshot.value.nodes.filter((node) => {
    return (
      node.x + node.width > bounds.minX - props.cullMargin &&
      node.x < bounds.maxX + props.cullMargin &&
      node.y + node.height > bounds.minY - props.cullMargin &&
      node.y < bounds.maxY + props.cullMargin
    )
  })
})

watch(
  visibleNodes,
  (nodes) => {
    renderStats.setVisibleNodeCount(nodes.length)
  },
  { immediate: true }
)
</script>

<template>
  <div class="canvas-viewport" :style="viewportStyle">
    <CanvasNodeCard
      v-for="node in visibleNodes"
      :key="node.id"
      :node="node"
      :selected="snapshot.selection.includes(node.id)"
      :editing="snapshot.interaction.mode === 'editing-text' && snapshot.interaction.nodeId === node.id"
    />
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
