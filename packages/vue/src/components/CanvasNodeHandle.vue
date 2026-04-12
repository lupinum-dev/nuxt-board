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
  --_size: calc(10px / var(--canvas-zoom, 1));
  --_half: calc(var(--_size) / 2);
  position: absolute;
  width: var(--_size);
  height: var(--_size);
  border: calc(1px / var(--canvas-zoom, 1)) solid currentColor;
  background: #fff;
}

.is-n,
.is-s {
  left: calc(50% - var(--_half));
}

.is-e,
.is-w {
  top: calc(50% - var(--_half));
}

.is-n,
.is-ne,
.is-nw {
  top: calc(-1 * var(--_half));
}

.is-s,
.is-se,
.is-sw {
  bottom: calc(-1 * var(--_half));
}

.is-e,
.is-ne,
.is-se {
  right: calc(-1 * var(--_half));
}

.is-w,
.is-nw,
.is-sw {
  left: calc(-1 * var(--_half));
}
</style>
