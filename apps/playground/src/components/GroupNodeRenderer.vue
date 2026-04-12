<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { CanvasNode } from '@canvas/core'
import { useCanvasEngine } from '@canvas/vue'

const props = defineProps<{
  node: CanvasNode
  selected: boolean
  editing: boolean
}>()

const { engine } = useCanvasEngine()

type GroupData = { title?: string; accent?: string }

const data = computed((): GroupData => (props.node.data ?? {}) as GroupData)

const title = computed(() =>
  typeof data.value.title === 'string' && data.value.title.length > 0
    ? data.value.title
    : 'Untitled group'
)

const accent = computed(() =>
  typeof data.value.accent === 'string' && data.value.accent.length > 0
    ? data.value.accent
    : '#0d9488'
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
  }
)

watch(title, (v) => {
  if (!props.editing) {
    draft.value = v
  }
})

function commit(): void {
  const trimmed = draft.value.trim()
  engine.updateNode(props.node.id, {
    data: { ...props.node.data, title: trimmed || 'Untitled group' }
  })
  engine.endInteraction()
}

function cancel(): void {
  draft.value = title.value
  engine.endInteraction()
}
</script>

<template>
  <div
    class="group-node"
    :style="{
      '--accent': accent,
      '--accent-bg': accent + '0a',
      '--accent-border': accent + '55',
      '--accent-glow': accent + '30'
    } as any"
    :class="{ 'is-selected': selected }"
  >
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
  border: calc(2px / var(--canvas-zoom, 1)) solid var(--accent-border);
  background: var(--accent-bg);
}

.group-node.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 calc(2px / var(--canvas-zoom, 1)) var(--accent-glow);
}

.group-node__label {
  position: absolute;
  left: 0;
  bottom: 100%;
  max-width: 100%;
  transform: scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: left bottom;
}

.group-node__title {
  display: inline-block;
  max-width: 100%;
  padding: 3px 10px;
  border-radius: 6px 6px 0 0;
  background: var(--accent);
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.group-node__input {
  display: block;
  width: 200px;
  max-width: 100%;
  padding: 3px 10px;
  border: none;
  border-radius: 6px 6px 0 0;
  background: var(--accent);
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.01em;
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
