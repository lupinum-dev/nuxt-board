<script setup lang="ts">
const camera = useCamera()
const nodes = useNodes()
const minimap = useMinimap(useBoardEngine().engine, { width: 120, height: 80 })
</script>

<template>
  <output
    class="board-probe"
    :data-minimap-nodes="minimap.minimapNodes.value.length"
    :data-nodes="nodes.size"
    :data-zoom="camera.z"
  >
    {{ nodes.size }} / {{ camera.z }}
  </output>
</template>
