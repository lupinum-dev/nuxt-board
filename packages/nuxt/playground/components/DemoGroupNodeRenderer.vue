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

type GroupData = {
  title?: string
  accent?: string
}

const groupData = computed(() => (props.node.data ?? {}) as GroupData)
const title = computed(() => groupData.value.title?.trim() || 'Untitled group')
const accent = computed(() => groupData.value.accent?.trim() || '#ea580c')
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
  }
)

watch(title, (value) => {
  if (!props.editing) {
    draft.value = value
  }
})

function commit(): void {
  engine.updateNode(props.node.id, {
    data: {
      ...props.node.data,
      title: draft.value.trim() || 'Untitled group',
    },
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
    class="group-frame"
    :class="{ 'is-selected': selected }"
    :style="{
      '--group-accent': accent,
      '--group-accent-soft': `${accent}18`,
      '--group-accent-border': `${accent}6b`,
    } as Record<string, string>"
  >
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
      >
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
  border: calc(2px / var(--canvas-zoom, 1)) solid var(--group-accent-border);
  background: var(--group-accent-soft);
}

.group-frame.is-selected {
  box-shadow: 0 0 0 calc(2px / var(--canvas-zoom, 1)) rgba(255, 255, 255, 0.9);
}

.group-frame__label {
  position: absolute;
  left: 0;
  bottom: 100%;
  max-width: 100%;
  transform: scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: left bottom;
}

.group-frame__title,
.group-frame__input {
  display: block;
  max-width: 15rem;
  padding: 0.3rem 0.75rem;
  border: none;
  border-radius: 10px 10px 0 0;
  background: var(--group-accent);
  color: #fff;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  outline: none;
}
</style>
