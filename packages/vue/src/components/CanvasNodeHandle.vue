<script setup lang="ts">
import type { ResizeHandle } from '@canvas/core'

defineProps<{
  handle: ResizeHandle
}>()
</script>

<template>
  <div class="canvas-node-handle" :class="`is-${handle}`" :data-resize="handle" />
</template>

<style scoped>
.canvas-node-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1px solid currentColor;
  background: #fff;
}

.is-n,
.is-s {
  left: calc(50% - 5px);
}

.is-e,
.is-w {
  top: calc(50% - 5px);
}

.is-n,
.is-ne,
.is-nw {
  top: -5px;
}

.is-s,
.is-se,
.is-sw {
  bottom: -5px;
}

.is-e,
.is-ne,
.is-se {
  right: -5px;
}

.is-w,
.is-nw,
.is-sw {
  left: -5px;
}
</style>
