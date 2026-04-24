<script setup lang="ts">
const camera = useAcmeCamera()
const nodes = useAcmeNodes()
</script>

<template>
  <output
    class="prefixed-board-probe"
    :data-nodes="nodes.size"
    :data-zoom="camera.z"
  >
    {{ nodes.size }} / {{ camera.z }}
  </output>
</template>
