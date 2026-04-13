<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from 'vue'
import type { BoardNode, ResizeHandle } from '@lupinum/board-core'
import { useBoardEngine } from '../useBoardEngine'
import BoardNodeHandle from './BoardNodeHandle.vue'

const props = defineProps<{
  node: BoardNode
  selected: boolean
  editing: boolean
  /** Pass true when a real custom renderer or slot is provided by the parent. */
  customRenderer?: boolean
}>()

const slots = useSlots()
const { engine } = useBoardEngine()
const handles: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const draft = ref(getTextContent(props.node))
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const style = computed(() => ({
  left: `${props.node.x}px`,
  top: `${props.node.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`,
  zIndex: String(props.node.zIndex)
}))

const slotProps = computed(() => ({
  node: props.node,
  selected: props.selected,
  editing: props.editing,
  beginEdit: () => engine.beginTextEdit(props.node.id),
  commitText: (text: string) => engine.commitTextEdit(props.node.id, text)
}))

// Use the explicit prop when provided (e.g. from BoardRoot); fall back to slot detection
// for direct/standalone usage of BoardNode.
const hasCustomRenderer = computed(() =>
  props.customRenderer !== undefined ? props.customRenderer : Boolean(slots.default)
)

watch(
  () => props.node,
  (node) => {
    draft.value = getTextContent(node)
  },
  { deep: true }
)

watch(
  () => props.editing,
  (editing) => {
    if (editing) {
      nextTick(() => {
        textareaRef.value?.focus()
        textareaRef.value?.select()
      })
    } else {
      draft.value = getTextContent(props.node)
    }
  }
)

function commit(): void {
  engine.commitTextEdit(props.node.id, draft.value)
}

function cancel(): void {
  draft.value = getTextContent(props.node)
  engine.endInteraction()
}

function getTextContent(node: BoardNode): string {
  if (node.type !== 'text') {
    return ''
  }
  const content = (node.data as Record<string, unknown>)?.content
  return typeof content === 'string' ? content : ''
}
</script>

<template>
  <article
    class="board-node"
    :class="{ 'is-selected': selected, 'is-editing': editing, 'is-locked': node.locked, 'is-group': node.type === 'group' }"
    :style="style"
    :data-node-id="node.id"
  >
    <!-- Custom renderer / user-provided slot -->
    <slot v-if="hasCustomRenderer" v-bind="slotProps" />

    <!-- Built-in text display / editing (no custom renderer) -->
    <template v-else>
      <textarea
        v-if="editing && node.type === 'text'"
        ref="textareaRef"
        v-model="draft"
        class="board-node__editor"
        data-editor="true"
        @blur="commit"
        @keydown.enter.meta.prevent="commit"
        @keydown.enter.ctrl.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <div v-else class="board-node__content">
        <template v-if="node.type === 'text'">
          {{ getTextContent(node) || 'Double-click to edit' }}
        </template>
        <template v-else>
          {{ node.type }}
        </template>
      </div>
    </template>

    <template v-if="selected && !editing && !node.locked">
      <slot
        v-for="handle in handles"
        :key="handle"
        name="handle"
        :node="node"
        :handle="handle"
      >
        <BoardNodeHandle :handle="handle" />
      </slot>
    </template>
  </article>
</template>

<style scoped>
.board-node {
  position: absolute;
  box-sizing: border-box;
  overflow: visible;
  border: calc(1px / var(--board-zoom, 1)) solid currentColor;
  color: inherit;
  background: var(--board-node-bg, #fff);
  contain: layout style;
}

.board-node.is-selected {
  outline: calc(3px / var(--board-zoom, 1)) solid currentColor;
}

.board-node.is-locked {
  opacity: 0.7;
}

.board-node.is-group {
  background: transparent;
  border: none;
  outline: none;
}

.board-node__content,
.board-node__editor {
  width: 100%;
  height: 100%;
  padding: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  resize: none;
  outline: none;
  white-space: pre-wrap;
}
</style>
