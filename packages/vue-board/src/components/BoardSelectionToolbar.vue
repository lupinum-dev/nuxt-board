<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BoardColorPreset, BoardNode, NodeId } from '@lupinum/board-core'
import { BOARD_COLOR_PRESETS } from '../nodeColors.js'
import { useBoardEngine } from '../useBoardEngine.js'
import { runBoardCommand } from '../composables/runBoardCommand.js'

const { engine, $camera, $nodes, $selection, $interaction } = useBoardEngine()
const paletteOpen = ref(false)

const selectedNodes = computed(() =>
  Array.from($selection.value)
    .map((id) => $nodes.value.get(id))
    .filter((node): node is BoardNode => Boolean(node)),
)

const bounds = computed(() => {
  if (selectedNodes.value.length === 0) {
    return null
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  for (const node of selectedNodes.value) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
  }
  return { minX, minY, maxX }
})

const position = computed(() => {
  if (!bounds.value) {
    return null
  }
  const camera = $camera.value
  return {
    left: `${((bounds.value.minX + bounds.value.maxX) / 2 + camera.x) * camera.z}px`,
    top: `${(bounds.value.minY + camera.y) * camera.z}px`,
  }
})

const showToolbar = computed(
  () =>
    selectedNodes.value.length > 0 &&
    $interaction.value.mode !== 'dragging-nodes' &&
    $interaction.value.mode !== 'resizing-node' &&
    $interaction.value.mode !== 'editing-text',
)

const canEdit = computed(() => selectedNodes.value.length === 1)

watch(
  () => Array.from($selection.value).join('\0'),
  () => {
    paletteOpen.value = false
  },
)

function stop(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
}

function applyColor(color: BoardColorPreset | undefined): void {
  engine.batch(() => {
    for (const node of selectedNodes.value) {
      if (!node.locked) {
        runBoardCommand(() => engine.updateNode(node.id, { color }))
      }
    }
  })
  paletteOpen.value = false
}

function removeSelected(event: MouseEvent): void {
  stop(event)
  runBoardCommand(() => engine.deleteSelected())
}

function togglePalette(event: MouseEvent): void {
  stop(event)
  paletteOpen.value = !paletteOpen.value
}

function zoomToSelection(event: MouseEvent): void {
  stop(event)
  void engine.zoomToNodes(
    selectedNodes.value.map((node) => node.id as NodeId),
    80,
    true,
  )
}

function editSelected(event: MouseEvent): void {
  stop(event)
  const node = selectedNodes.value[0]
  if (node) {
    runBoardCommand(() => engine.beginTextEdit(node.id))
  }
}

const currentColor = computed(() => {
  const colors = selectedNodes.value.map((node) => node.color ?? null)
  return colors.every((color) => color === colors[0]) ? colors[0] : 'mixed'
})
</script>

<template>
  <div
    v-if="showToolbar && position"
    class="board-selection-toolbar"
    data-board-interactive="true"
    data-node-selection-toolbar="true"
    :style="position"
    @pointerdown.stop
    @mousedown.stop
    @dblclick.stop
  >
    <button
      type="button"
      class="board-selection-toolbar__button is-danger"
      aria-label="Remove"
      title="Remove"
      @click="removeSelected"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
        <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
      </svg>
    </button>

    <div class="board-selection-toolbar__popover-anchor">
      <button
        type="button"
        class="board-selection-toolbar__button"
        aria-label="Set colour"
        title="Set colour"
        data-node-color-menu-button="true"
        @click="togglePalette"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 3h-4a2 2 0 0 0 -2 2v12a4 4 0 0 0 8 0v-12a2 2 0 0 0 -2 -2"
          />
          <path
            d="M13 7.35l-2 -2a2 2 0 0 0 -2.828 0l-2.828 2.828a2 2 0 0 0 0 2.828l9 9"
          />
          <path d="M7.3 13h-2.3a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h12" />
          <path d="M17 17l0 .01" />
        </svg>
      </button>

      <div
        v-if="paletteOpen"
        class="board-selection-toolbar__palette"
        data-node-color-menu="true"
      >
        <button
          type="button"
          class="board-selection-toolbar__swatch is-default"
          :class="{ 'is-active': currentColor === null }"
          aria-label="Default colour"
          title="Default colour"
          data-node-color-option="default"
          @click.stop.prevent="applyColor(undefined)"
        />
        <button
          v-for="option in BOARD_COLOR_PRESETS"
          :key="option.preset"
          type="button"
          class="board-selection-toolbar__swatch"
          :class="{ 'is-active': currentColor === option.preset }"
          :style="{
            '--swatch-color': `var(--board-preset-${option.preset}, ${option.hex})`,
          }"
          :aria-label="option.label"
          :title="option.label"
          :data-node-color-option="option.preset"
          @click.stop.prevent="applyColor(option.preset)"
        />
      </div>
    </div>

    <button
      type="button"
      class="board-selection-toolbar__button"
      aria-label="Zoom to selection"
      title="Zoom to selection"
      @click="zoomToSelection"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="12" r="5" />
        <path d="M12 3v2" />
        <path d="M3 12h2" />
        <path d="M12 19v2" />
        <path d="M19 12h2" />
      </svg>
    </button>

    <button
      type="button"
      class="board-selection-toolbar__button"
      :disabled="!canEdit"
      aria-label="Edit"
      title="Edit"
      @click="editSelected"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.board-selection-toolbar {
  position: absolute;
  z-index: 12;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--board-border, rgba(15, 23, 42, 0.1));
  border-radius: 10px;
  background: var(--board-bg-elevated, #ffffff);
  box-shadow:
    0 8px 24px -6px rgba(9, 14, 28, 0.18),
    0 1px 2px rgba(9, 14, 28, 0.08);
  transform: translate(-50%, calc(-100% - 14px));
  pointer-events: auto;
  user-select: none;
  backdrop-filter: saturate(1.2);
}

.board-selection-toolbar__button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--board-muted-fg, #5b6075);
  cursor: pointer;
  transition:
    background-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    color var(--board-dur-fast, 120ms) var(--board-ease-out, ease);
}

.board-selection-toolbar__button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--board-fg, #14161f) 6%, transparent);
  color: var(--board-fg, #14161f);
}

.board-selection-toolbar__button:disabled {
  cursor: default;
  opacity: 0.38;
}

.board-selection-toolbar__button.is-danger {
  color: var(--board-preset-1, #e5476a);
}

.board-selection-toolbar__button.is-danger:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--board-preset-1, #e5476a) 10%,
    transparent
  );
  color: var(--board-preset-1, #e5476a);
}

.board-selection-toolbar__button svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.board-selection-toolbar__popover-anchor {
  position: relative;
  display: inline-flex;
}

.board-selection-toolbar__palette {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 1;
  display: inline-flex;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--board-border, rgba(15, 23, 42, 0.1));
  border-radius: 10px;
  background: var(--board-bg-elevated, #ffffff);
  box-shadow:
    0 12px 32px -8px rgba(9, 14, 28, 0.22),
    0 1px 2px rgba(9, 14, 28, 0.08);
  transform: translateX(-50%);
  animation: board-palette-in var(--board-dur-fast, 140ms)
    var(--board-ease-out, ease);
}

@keyframes board-palette-in {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

.board-selection-toolbar__swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 999px;
  background: var(--swatch-color);
  cursor: pointer;
  transition: transform var(--board-dur-fast, 120ms)
    var(--board-ease-spring, ease);
}

.board-selection-toolbar__swatch:hover {
  transform: scale(1.12);
}

.board-selection-toolbar__swatch.is-default {
  --swatch-color: var(--board-border-strong, #c9cbdb);
}

.board-selection-toolbar__swatch.is-active {
  box-shadow:
    0 0 0 2px var(--board-bg-elevated, #ffffff),
    0 0 0 4px var(--swatch-color);
}

@media (prefers-reduced-motion: reduce) {
  .board-selection-toolbar,
  .board-selection-toolbar__button,
  .board-selection-toolbar__swatch,
  .board-selection-toolbar__palette {
    animation: none;
    transition: none;
  }
}
</style>
