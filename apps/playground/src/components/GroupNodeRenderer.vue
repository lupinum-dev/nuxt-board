<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { BoardNode } from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'

const props = defineProps<{
  node: BoardNode
  selected: boolean
  editing: boolean
}>()

const { engine } = useBoardEngine()

const title = computed(() =>
  typeof props.node.label === 'string' && props.node.label.length > 0
    ? props.node.label
    : 'Untitled group',
)

const draft = ref(title.value)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  (editing) => {
    if (editing) {
      draft.value = title.value
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
)

watch(title, (v) => {
  if (!props.editing) {
    draft.value = v
  }
})

function commit(): void {
  const trimmed = draft.value.trim()
  engine.updateNode(props.node.id, {
    label: trimmed || 'Untitled group',
  })
  engine.endInteraction()
}

function cancel(): void {
  draft.value = title.value
  engine.endInteraction()
}
</script>

<template>
  <div class="group-node" :class="{ 'is-selected': selected }">
    <div class="group-node__label">
      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        class="group-node__input"
        data-editor="true"
        spellcheck="false"
        @blur="commit"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <span v-else class="group-node__title">{{ title }}</span>
    </div>
  </div>
</template>

<style scoped>
.group-node {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: visible;
  border: calc(1.5px / var(--board-zoom, 1)) solid
    var(--board-node-color-soft, var(--board-group-border));
  background: var(--board-node-tint, var(--board-group-bg));
  transition:
    border-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    box-shadow var(--board-dur-fast, 120ms) var(--board-ease-out, ease);
}

.group-node.is-selected {
  border-color: var(--board-node-color, var(--board-node-selection));
  box-shadow: 0 0 0 calc(4px / var(--board-zoom, 1))
    color-mix(
      in srgb,
      var(--board-node-color, var(--board-accent)) 22%,
      transparent
    );
}

.group-node__label {
  position: absolute;
  left: 0;
  bottom: 100%;
  max-width: 100%;
  transform: scale(calc(1 / var(--board-zoom, 1)));
  transform-origin: left bottom;
}

.group-node__title {
  display: inline-block;
  max-width: 100%;
  padding: 4px 10px 3px;
  border-radius: 8px 8px 0 0;
  background: var(--board-node-color, var(--board-node-selection));
  color: #fff;
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

.group-node__input {
  display: block;
  width: 200px;
  max-width: 100%;
  padding: 4px 10px 3px;
  border: none;
  border-radius: 8px 8px 0 0;
  background: var(--board-node-color, var(--board-node-selection));
  color: #fff;
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.02em;
  outline: none;
  caret-color: #fff;
}

.group-node__input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.group-node__input::selection {
  background: rgba(255, 255, 255, 0.3);
}
</style>
