<script setup lang="ts">
const camera = useAcmeBoardCamera()
const nodes = useAcmeBoardNodes()
const minimap = useAcmeBoardMinimap(useAcmeBoardEngine().engine, {
  width: 120,
  height: 80,
})
</script>

<template>
  <output
    class="prefixed-board-probe"
    :data-minimap-nodes="minimap.minimapNodes.value.length"
    :data-nodes="nodes.size"
    :data-zoom="camera.z"
  >
    {{ nodes.size }} / {{ camera.z }}
  </output>
</template>
