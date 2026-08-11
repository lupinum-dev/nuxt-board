<script setup lang="ts">
import type { NodeId, ResizeHandle } from '@lupinum/board-core'
import { useBoardEngine } from '../useBoardEngine.js'
import { runBoardCommand } from '../composables/runBoardCommand.js'

const props = defineProps<{
  handle: ResizeHandle
  nodeId?: NodeId
}>()

const { engine, $grid } = useBoardEngine()
const handleLabels: Record<ResizeHandle, string> = {
  n: 'Resize from top',
  ne: 'Resize from top right',
  e: 'Resize from right',
  se: 'Resize from bottom right',
  s: 'Resize from bottom',
  sw: 'Resize from bottom left',
  w: 'Resize from left',
  nw: 'Resize from top left',
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.nodeId || !event.key.startsWith('Arrow')) return

  const horizontal = props.handle.includes('e') || props.handle.includes('w')
  const vertical = props.handle.includes('n') || props.handle.includes('s')
  const step = event.shiftKey
    ? $grid.value.size * $grid.value.majorEvery
    : $grid.value.size
  const dx = horizontal
    ? event.key === 'ArrowLeft'
      ? -step
      : event.key === 'ArrowRight'
        ? step
        : 0
    : 0
  const dy = vertical
    ? event.key === 'ArrowUp'
      ? -step
      : event.key === 'ArrowDown'
        ? step
        : 0
    : 0

  if (dx === 0 && dy === 0) return
  event.preventDefault()
  event.stopPropagation()
  runBoardCommand(() => engine.resizeNode(props.nodeId!, props.handle, dx, dy))
}
</script>

<template>
  <button
    type="button"
    class="board-node-handle"
    :class="`is-${handle}`"
    :data-resize="handle"
    :aria-label="handleLabels[handle]"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.board-node-handle {
  --_hit: calc(18px / var(--board-zoom, 1));
  --_dot: calc(7px / var(--board-zoom, 1));
  --_half: calc(var(--_hit) / 2);
  position: absolute;
  width: var(--_hit);
  height: var(--_hit);
  box-sizing: border-box;
  border: 0;
  background: transparent;
  cursor: nwse-resize;
  transition: transform var(--board-dur-fast, 120ms) var(--board-ease-out, ease);
}

.board-node-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--_dot);
  height: var(--_dot);
  box-sizing: border-box;
  border: calc(1px / var(--board-zoom, 1)) solid
    var(--board-node-selection, var(--board-accent, #6366e8));
  border-radius: calc(1.5px / var(--board-zoom, 1));
  background: var(--board-node-handle-bg, var(--board-node-bg, #fff));
  transform: translate(-50%, -50%);
  transition:
    background-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    transform var(--board-dur-fast, 120ms) var(--board-ease-out, ease);
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

.board-node-handle:hover::before {
  background: var(--board-node-selection, var(--board-accent, #6366e8));
  transform: translate(-50%, -50%) scale(1.15);
}

@media (pointer: coarse) {
  .board-node-handle {
    --_hit: calc(36px / var(--board-zoom, 1));
    --_dot: calc(9px / var(--board-zoom, 1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-node-handle {
    transition: none;
  }
}
</style>
