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

const title = computed(() => props.node.label?.trim() || 'Untitled group')
const draft = ref(title.value)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  (editing) => {
    if (!editing) {
      draft.value = title.value
      return
    }
    draft.value = title.value
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  },
)

watch(title, (value) => {
  if (!props.editing) {
    draft.value = value
  }
})

function commit(): void {
  engine.updateNode(props.node.id, {
    label: draft.value.trim() || 'Untitled group',
  })
  engine.cancelTextEdit()
}

function cancel(): void {
  draft.value = title.value
  engine.cancelTextEdit()
}
</script>

<template>
  <div class="group-frame" :class="{ 'is-selected': selected }">
    <div class="group-frame__label">
      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        class="group-frame__input"
        data-editor="true"
        spellcheck="false"
        @blur="commit"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <span v-else class="group-frame__title">{{ title }}</span>
    </div>
  </div>
</template>

<style scoped>
.group-frame {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  border: calc(2px / var(--board-zoom, 1)) solid var(--group-accent-border);
  border-color: var(--board-node-color-soft, var(--board-group-border));
  background: var(--board-node-tint, var(--board-group-bg));
}

.group-frame.is-selected {
  box-shadow: 0 0 0 calc(2px / var(--board-zoom, 1)) rgba(255, 255, 255, 0.9);
}

.group-frame__label {
  position: absolute;
  left: 0;
  bottom: 100%;
  max-width: 100%;
  transform: scale(calc(1 / var(--board-zoom, 1)));
  transform-origin: left bottom;
}

.group-frame__title,
.group-frame__input {
  display: block;
  max-width: 15rem;
  padding: 0.3rem 0.75rem;
  border: none;
  border-radius: 6px 6px 0 0;
  background: var(--board-node-color, var(--board-node-selection));
  color: #fff;
  font-family: var(--playground-sans);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  outline: none;
}
</style>
