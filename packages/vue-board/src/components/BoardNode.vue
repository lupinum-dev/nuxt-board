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
  border: calc(1px / var(--board-zoom, 1)) solid var(--board-node-border, rgba(148, 163, 184, 0.28));
  border-radius: calc(18px / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow, 0 18px 40px -30px rgba(15, 23, 42, 0.22));
  background: var(--board-node-bg, #fff);
  color: inherit;
  contain: layout style;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease,
    outline-color 140ms ease,
    transform 140ms ease;
}

.board-node:hover:not(.is-group):not(.is-editing) {
  border-color: var(--board-node-border-hover, rgba(100, 116, 139, 0.42));
  box-shadow: var(--board-node-shadow-hover, 0 22px 48px -28px rgba(15, 23, 42, 0.28));
  transform: translateY(calc(-1px / var(--board-zoom, 1)));
}

.board-node.is-selected {
  outline: calc(2.5px / var(--board-zoom, 1)) solid var(--board-node-ring, rgba(15, 118, 110, 0.38));
  outline-offset: calc(1px / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow-selected, 0 24px 52px -28px rgba(15, 23, 42, 0.32));
}

.board-node.is-editing {
  outline: calc(2.5px / var(--board-zoom, 1)) solid var(--board-node-ring, rgba(15, 118, 110, 0.38));
  outline-offset: calc(1px / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow-selected, 0 24px 52px -28px rgba(15, 23, 42, 0.32));
}

.board-node.is-locked {
  opacity: 0.8;
  filter: saturate(0.82);
}

.board-node.is-group {
  background: var(--board-group-bg, rgba(15, 23, 42, 0.04));
  border-style: dashed;
  border-color: var(--board-group-border, rgba(15, 23, 42, 0.12));
  outline: none;
  box-shadow: none;
  transform: none;
}

.board-node__content,
.board-node__editor {
  width: 100%;
  height: 100%;
  padding: 16px 18px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  resize: none;
  outline: none;
  white-space: pre-wrap;
}

.board-node__content {
  display: flex;
  align-items: flex-start;
  line-height: 1.45;
  letter-spacing: -0.01em;
}

@media (prefers-reduced-motion: reduce) {
  .board-node {
    transition: none;
  }
}
</style>
