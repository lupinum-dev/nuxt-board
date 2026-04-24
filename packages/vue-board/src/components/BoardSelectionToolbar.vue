<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BoardColorPreset, BoardNode, NodeId } from '@lupinum/board-core'
import { BOARD_COLOR_PRESETS } from '../nodeColors'
import { useBoardEngine } from '../useBoardEngine'

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
        engine.updateNode(node.id, { color })
      }
    }
  })
  paletteOpen.value = false
}

function removeSelected(event: MouseEvent): void {
  stop(event)
  engine.deleteSelected()
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
    engine.beginTextEdit(node.id)
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
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
            d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
          />
          <circle cx="13.5" cy="6.5" r="0.5" />
          <circle cx="17.5" cy="10.5" r="0.5" />
          <circle cx="6.5" cy="12.5" r="0.5" />
          <circle cx="8.5" cy="7.5" r="0.5" />
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
          :style="{ '--swatch-color': option.hex }"
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
        <path d="M2 6V4a2 2 0 0 1 2-2h2" />
        <path d="M18 2h2a2 2 0 0 1 2 2v2" />
        <path d="M22 18v2a2 2 0 0 1-2 2h-2" />
        <path d="M6 22H4a2 2 0 0 1-2-2v-2" />
        <path d="m15 15 5 5" />
        <circle cx="11" cy="11" r="5" />
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
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path
          d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
        />
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
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--board-node-border, rgba(15, 23, 42, 0.1));
  border-radius: 6px;
  background: var(--board-node-bg, #ffffff);
  box-shadow:
    0 4px 14px rgba(15, 23, 42, 0.12),
    0 1px 2px rgba(15, 23, 42, 0.08);
  transform: translate(-50%, calc(-100% - 14px));
  pointer-events: auto;
  user-select: none;
}

.board-selection-toolbar__button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--board-muted-fg, #6b7280);
  cursor: pointer;
}

.board-selection-toolbar__button:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
  color: var(--board-fg, #0f172a);
}

.board-selection-toolbar__button:disabled {
  cursor: default;
  opacity: 0.38;
}

.board-selection-toolbar__button.is-danger {
  color: #b45353;
}

.board-selection-toolbar__button svg {
  width: 24px;
  height: 24px;
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
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--board-node-border, rgba(15, 23, 42, 0.1));
  border-radius: 6px;
  background: var(--board-node-bg, #ffffff);
  box-shadow:
    0 8px 22px rgba(15, 23, 42, 0.16),
    0 1px 2px rgba(15, 23, 42, 0.08);
  transform: translateX(-50%);
}

.board-selection-toolbar__swatch {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 999px;
  background: var(--swatch-color);
  cursor: pointer;
}

.board-selection-toolbar__swatch.is-default {
  --swatch-color: #c7c7c7;
}

.board-selection-toolbar__swatch.is-active {
  box-shadow:
    0 0 0 3px var(--board-node-bg, #ffffff),
    0 0 0 5px var(--swatch-color);
}
</style>
