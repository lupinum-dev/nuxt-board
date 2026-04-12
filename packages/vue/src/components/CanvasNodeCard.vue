<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref, useTemplateRef, watch } from 'vue'
import type { CanvasNode, ResizeHandle } from '@canvas/core'
import { useCanvasEngine } from '../useCanvasEngine'

const props = defineProps<{
  node: CanvasNode
  selected: boolean
  editing: boolean
}>()

const { engine, renderStats } = useCanvasEngine()
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
const draft = ref(props.node.text)

const handles: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

const cardStyle = computed(() => ({
  left: `${props.node.x}px`,
  top: `${props.node.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`,
  zIndex: String(props.node.zIndex)
}))

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      draft.value = props.node.text
      return
    }
    await nextTick()
    textarea.value?.focus()
    textarea.value?.select()
  },
  { immediate: true }
)

watch(
  () => props.node.text,
  (value) => {
    if (!props.editing) {
      draft.value = value
    }
  }
)

function commit(): void {
  engine.commitTextEdit(props.node.id, draft.value)
}

function cancel(): void {
  draft.value = props.node.text
  engine.endInteraction()
}

onMounted(renderStats.incrementRenderCount)
onUpdated(renderStats.incrementRenderCount)
</script>

<template>
  <article
    class="canvas-node-card"
    :class="{ 'is-selected': selected, 'is-editing': editing }"
    :style="cardStyle"
    :data-node-id="node.id"
  >
    <textarea
      v-if="editing"
      ref="textarea"
      v-model="draft"
      class="canvas-node-card__editor"
      data-editor="true"
      @blur="commit"
      @keydown.enter.meta.prevent="commit"
      @keydown.enter.ctrl.prevent="commit"
      @keydown.esc.prevent="cancel"
    />
    <div v-else class="canvas-node-card__content">
      {{ node.text || 'Double-click to edit' }}
    </div>

    <template v-if="selected && !editing">
      <div
        v-for="handle in handles"
        :key="handle"
        class="canvas-node-card__handle"
        :class="`is-${handle}`"
        :data-resize="handle"
      />
    </template>
  </article>
</template>

<style scoped>
.canvas-node-card {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 252, 0.96));
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  contain: layout style;
  overflow: visible;
}

.canvas-node-card.is-selected {
  border-color: rgba(2, 132, 199, 0.7);
  box-shadow:
    0 0 0 2px rgba(14, 165, 233, 0.28),
    0 18px 40px rgba(15, 23, 42, 0.12);
}

.canvas-node-card__content,
.canvas-node-card__editor {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #0f172a;
  font: 500 16px/1.45 "IBM Plex Sans", "Avenir Next", sans-serif;
  resize: none;
  outline: none;
  white-space: pre-wrap;
}

.canvas-node-card__content {
  user-select: none;
}

.canvas-node-card__handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: #0284c7;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
}

.is-n,
.is-s {
  left: calc(50% - 6px);
}

.is-e,
.is-w {
  top: calc(50% - 6px);
}

.is-n,
.is-ne,
.is-nw {
  top: -6px;
}

.is-s,
.is-se,
.is-sw {
  bottom: -6px;
}

.is-e,
.is-ne,
.is-se {
  right: -6px;
}

.is-w,
.is-nw,
.is-sw {
  left: -6px;
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
</style>
