<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import type { CanvasNode, ResizeHandle } from '@canvas/core'
import { useCanvasEngine } from '../useCanvasEngine'
import CanvasNodeHandle from './CanvasNodeHandle.vue'

const props = defineProps<{
  node: CanvasNode
  selected: boolean
  editing: boolean
}>()

const slots = useSlots()
const { engine } = useCanvasEngine()
const handles: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const draft = ref(getTextContent(props.node))

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

const hasCustomRenderer = computed(() => Boolean(slots.default))

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
    if (!editing) {
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

function getTextContent(node: CanvasNode): string {
  if (node.type !== 'text') {
    return ''
  }
  const content = (node.data as Record<string, unknown>)?.content
  return typeof content === 'string' ? content : ''
}
</script>

<template>
  <article
    class="canvas-node"
    :class="{ 'is-selected': selected, 'is-editing': editing, 'is-locked': node.locked }"
    :style="style"
    :data-node-id="node.id"
  >
    <slot v-bind="slotProps">
      <textarea
        v-if="editing && !hasCustomRenderer && node.type === 'text'"
        v-model="draft"
        class="canvas-node__editor"
        data-editor="true"
        @blur="commit"
        @keydown.enter.meta.prevent="commit"
        @keydown.enter.ctrl.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <div v-else class="canvas-node__content">
        <template v-if="node.type === 'text'">
          {{ getTextContent(node) || 'Double-click to edit' }}
        </template>
        <template v-else>
          {{ node.type }}
        </template>
      </div>
    </slot>

    <template v-if="selected && !editing && !node.locked">
      <slot
        v-for="handle in handles"
        :key="handle"
        name="handle"
        :node="node"
        :handle="handle"
      >
        <CanvasNodeHandle :handle="handle" />
      </slot>
    </template>
  </article>
</template>

<style scoped>
.canvas-node {
  position: absolute;
  box-sizing: border-box;
  overflow: visible;
  border: 1px solid currentColor;
  color: #0f172a;
  background: #fff;
}

.canvas-node.is-selected {
  outline: 1px solid currentColor;
}

.canvas-node.is-locked {
  opacity: 0.7;
}

.canvas-node__content,
.canvas-node__editor {
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
