<script setup lang="ts">
import type { ResizeHandle } from '@lupinum/board-core'

defineProps<{
  handle: ResizeHandle
}>()
</script>

<template>
  <div class="board-node-handle" :class="`is-${handle}`" :data-resize="handle" />
</template>

<style scoped>
.board-node-handle {
  --_hit: calc(16px / var(--board-zoom, 1));
  --_size: calc(9px / var(--board-zoom, 1));
  --_half: calc(var(--_hit) / 2);
  position: absolute;
  width: var(--_hit);
  height: var(--_hit);
  border-radius: 999px;
  background: transparent;
  cursor: nwse-resize;
  transition: transform 120ms ease;
}

.board-node-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--_size);
  height: var(--_size);
  border: calc(1.5px / var(--board-zoom, 1)) solid var(--board-node-border-hover, rgba(100, 116, 139, 0.42));
  border-radius: 999px;
  background: var(--board-node-bg, #fff);
  box-shadow:
    0 0 0 calc(1px / var(--board-zoom, 1)) rgba(255, 255, 255, 0.72),
    0 6px 16px -10px var(--board-handle-shadow, rgba(15, 23, 42, 0.12));
  transform: translate(-50%, -50%);
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

.is-n,
.is-s {
  cursor: ns-resize;
}

.is-e,
.is-w {
  cursor: ew-resize;
}

.is-ne,
.is-sw {
  cursor: nesw-resize;
}

.is-nw,
.is-se {
  cursor: nwse-resize;
}

.board-node-handle:hover {
  transform: scale(1.06);
}

@media (prefers-reduced-motion: reduce) {
  .board-node-handle {
    transition: none;
  }
}
</style>
