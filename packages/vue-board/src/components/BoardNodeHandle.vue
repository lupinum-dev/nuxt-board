<script setup lang="ts">
import type { ResizeHandle } from '@lupinum/board-core'

defineProps<{
  handle: ResizeHandle
}>()
</script>

<template>
  <div
    class="board-node-handle"
    :class="`is-${handle}`"
    :data-resize="handle"
  />
</template>

<style scoped>
.board-node-handle {
  --_hit: calc(22px / var(--board-zoom, 1));
  --_box: calc(18px / var(--board-zoom, 1));
  --_dot: calc(10px / var(--board-zoom, 1));
  --_half: calc(var(--_hit) / 2);
  position: absolute;
  width: var(--_hit);
  height: var(--_hit);
  box-sizing: border-box;
  border: 0;
  border-radius: calc(2px / var(--board-zoom, 1));
  background: transparent;
  cursor: nwse-resize;
  transition:
    background-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.board-node-handle::before {
  content: '';
  position: absolute;
  inset: calc((var(--_hit) - var(--_box)) / 2);
  box-sizing: border-box;
  border: calc(2px / var(--board-zoom, 1)) solid
    var(--board-node-selection, var(--board-accent, #0f766e));
  border-radius: calc(1px / var(--board-zoom, 1));
  background: var(--board-node-handle-bg, var(--board-node-bg, #fff));
}

.board-node-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--_dot);
  height: var(--_dot);
  border: calc(2px / var(--board-zoom, 1)) solid
    var(--board-node-handle-dot, rgba(148, 163, 184, 0.72));
  border-radius: 999px;
  background: var(--board-node-handle-bg, var(--board-node-bg, #fff));
  box-shadow: 0 0 0 calc(1px / var(--board-zoom, 1))
    var(--board-node-handle-bg, var(--board-node-bg, #fff));
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
  background: color-mix(
    in srgb,
    var(--board-node-selection, var(--board-accent, #0f766e)) 8%,
    transparent
  );
  box-shadow: 0 0 0 calc(2px / var(--board-zoom, 1))
    color-mix(
      in srgb,
      var(--board-node-selection, var(--board-accent, #0f766e)) 16%,
      transparent
    );
  transform: scale(1.06);
}

@media (pointer: coarse) {
  .board-node-handle {
    --_hit: calc(44px / var(--board-zoom, 1));
    --_box: calc(20px / var(--board-zoom, 1));
    --_dot: calc(10px / var(--board-zoom, 1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-node-handle {
    transition: none;
  }
}
</style>
