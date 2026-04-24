<script setup lang="ts">
const camera = useCamera()
const nodes = useNodes()
</script>

<template>
  <output class="board-probe" :data-nodes="nodes.size" :data-zoom="camera.z">
    {{ nodes.size }} / {{ camera.z }}
  </output>
</template>
