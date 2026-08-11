<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from 'vue'
import type { BoardNode, ResizeHandle } from '@lupinum/board-core'
import { useBoardEngine } from '../useBoardEngine.js'
import { runBoardCommand } from '../composables/runBoardCommand.js'
import { resolveNodeColorStyle } from '../nodeColors.js'
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
  zIndex: String(props.node.zIndex),
  ...resolveNodeColorStyle(props.node.color),
}))

function beginTextEdit(): void {
  if (props.node.type !== 'text') return
  runBoardCommand(() => engine.beginTextEdit(props.node.id))
}

function commitTextEdit(text: string): void {
  if (props.node.type !== 'text') return
  runBoardCommand(() => engine.commitTextEdit(props.node.id, text))
}

const slotProps = computed(() => ({
  node: props.node,
  selected: props.selected,
  editing: props.editing,
  beginEdit: beginTextEdit,
  commitText: commitTextEdit,
}))

// Use the explicit prop when provided (e.g. from BoardRoot); fall back to slot detection
// for direct/standalone usage of BoardNode.
function hasCustomRenderer(): boolean {
  return props.customRenderer !== undefined
    ? props.customRenderer
    : Boolean(slots.default)
}

const accessibleLabel = computed(() => {
  let label: string
  if (props.node.type === 'text') {
    label = getTextContent(props.node) || 'Empty text node'
  } else {
    label = `${props.node.type} node`
  }
  return props.selected ? `${label}, selected` : label
})

const editorHelp = computed(() =>
  `${props.node.id}-editor-help`
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-'),
)

watch(
  () => props.node,
  (node) => {
    draft.value = getTextContent(node)
  },
  { deep: true },
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
  },
)

function commit(): void {
  runBoardCommand(() => engine.commitTextEdit(props.node.id, draft.value))
}

function cancel(): void {
  draft.value = getTextContent(props.node)
  runBoardCommand(() => engine.cancelTextEdit())
}

function onEditorKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }

  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    commit()
  }
}

function beginKeyboardEdit(event: KeyboardEvent): void {
  if (isEditingTarget(event.target)) {
    return
  }
  if (props.node.type !== 'text') return
  event.preventDefault()
  beginTextEdit()
}

function selectOnFocus(): void {
  if (!props.selected) {
    runBoardCommand(() => engine.select(props.node.id))
  }
}

function isEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && Boolean(target.closest('[data-editor]'))
  )
}

function getTextContent(node: BoardNode): string {
  if (node.type !== 'text') {
    return ''
  }
  return typeof node.text === 'string' ? node.text : ''
}
</script>

<template>
  <article
    class="board-node"
    :class="{
      'is-selected': selected,
      'is-editing': editing,
      'is-locked': node.locked,
      'is-group': node.type === 'group',
      'is-colored': Boolean(node.color),
    }"
    :style="style"
    :data-node-id="node.id"
    tabindex="0"
    role="group"
    aria-roledescription="board node"
    :aria-label="accessibleLabel"
    @focus="selectOnFocus"
    @keydown.enter.stop="beginKeyboardEdit"
  >
    <!-- Custom renderer / user-provided slot -->
    <slot v-if="hasCustomRenderer()" v-bind="slotProps" />

    <!-- Built-in text display / editing (no custom renderer) -->
    <template v-else>
      <template v-if="editing && node.type === 'text'">
        <textarea
          ref="textareaRef"
          v-model="draft"
          class="board-node__editor"
          data-editor="true"
          :aria-describedby="editorHelp"
          spellcheck="true"
          @blur="commit"
          @keydown="onEditorKeydown"
          @pointerdown.stop
          @dblclick.stop
        />
        <span :id="editorHelp" class="board-node__editor-help">
          Enter inserts a new line. Control Enter or Command Enter saves.
        </span>
      </template>
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
        <BoardNodeHandle :handle="handle" :node-id="node.id" />
      </slot>
    </template>
  </article>
</template>

<style scoped>
.board-node {
  position: absolute;
  box-sizing: border-box;
  overflow: visible;
  border: calc(1px / var(--board-zoom, 1)) solid
    var(--board-node-border, rgba(148, 163, 184, 0.28));
  border-radius: calc(var(--board-node-radius, 10px) / var(--board-zoom, 1));
  box-shadow: var(--board-node-shadow, 0 0.5px 1px 0.5px rgba(9, 14, 28, 0.08));
  background: var(--board-node-bg, #fff);
  color: inherit;
  contain: layout style;
  transform: translateZ(0);
  transition:
    border-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    box-shadow var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    background-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    outline-color var(--board-dur-fast, 120ms) var(--board-ease-out, ease),
    transform var(--board-dur-fast, 120ms) var(--board-ease-out, ease);
}

.board-node:hover:not(.is-group):not(.is-editing) {
  border-color: var(--board-node-border-hover, rgba(100, 116, 139, 0.42));
  box-shadow: var(
    --board-node-shadow-hover,
    0 2px 8px -2px rgba(9, 14, 28, 0.12)
  );
}

.board-node:focus-visible {
  outline: calc(2px / var(--board-zoom, 1)) solid
    var(--board-node-ring, rgba(99, 102, 232, 0.42));
  outline-offset: calc(2px / var(--board-zoom, 1));
}

.board-node.is-selected {
  border-color: var(
    --board-node-color-ring,
    var(--board-node-selection, var(--board-accent, #6366e8))
  );
  box-shadow:
    0 0 0 calc(1px / var(--board-zoom, 1))
      var(
        --board-node-color-ring,
        var(--board-node-selection, var(--board-accent, #6366e8))
      ),
    var(--board-node-shadow-selected, var(--board-node-shadow, none));
}

.board-node.is-editing {
  border-color: var(
    --board-node-color-ring,
    var(--board-node-selection, var(--board-accent, #6366e8))
  );
  box-shadow:
    0 0 0 calc(1px / var(--board-zoom, 1))
      var(
        --board-node-color-ring,
        var(--board-node-selection, var(--board-accent, #6366e8))
      ),
    var(--board-node-shadow-selected, var(--board-node-shadow, none));
}

.board-node.is-locked {
  opacity: 0.8;
  filter: saturate(0.82);
}

.board-node.is-group {
  background: var(--board-group-bg, rgba(99, 102, 232, 0.05));
  border-style: dashed;
  border-color: var(--board-group-border, rgba(99, 102, 232, 0.26));
  border-radius: calc(var(--board-group-radius, 16px) / var(--board-zoom, 1));
  outline: none;
  box-shadow: none;
}

.board-node.is-colored:not(.is-group) {
  background: var(--board-node-tint);
  border-color: var(--board-node-color);
}

.board-node.is-colored:not(.is-group):hover:not(.is-editing) {
  background: var(--board-node-tint-strong);
  border-color: var(--board-node-color);
}

.board-node.is-group.is-colored {
  background: var(--board-node-tint);
  border-color: var(--board-node-color);
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
  overflow: auto;
  white-space: pre-wrap;
}

.board-node__content {
  display: flex;
  align-items: flex-start;
  line-height: 1.45;
  letter-spacing: -0.01em;
}

.board-node__editor {
  display: block;
  user-select: text;
  cursor: text;
  line-height: 1.45;
  letter-spacing: -0.01em;
  caret-color: var(--board-node-selection, var(--board-accent, #0f766e));
}

.board-node__editor::selection {
  background: color-mix(
    in srgb,
    var(--board-node-selection, var(--board-accent, #0f766e)) 22%,
    transparent
  );
}

.board-node__editor-help {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .board-node {
    transition: none;
  }
}
</style>
