<template>
  <div style="display: flex; flex-direction: column; height: 100vh; font-family: sans-serif;">
    <header style="padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 16px; background: #fff; flex-shrink: 0;">
      <strong>@canvas/nuxt playground</strong>
      <button
        @click="addNode"
        style="padding: 6px 14px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;"
      >
        Add node
      </button>
      <button
        @click="clearAll"
        style="padding: 6px 14px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;"
      >
        Clear
      </button>
      <span style="color: #64748b; font-size: 13px;">
        {{ nodeCount }} node(s) — double-click canvas to create, drag to move
      </span>
    </header>

    <main style="flex: 1; position: relative; min-height: 0;">
      <!-- CanvasRoot is auto-imported as a client-only component by @canvas/nuxt -->
      <CanvasRoot
        style="width: 100%; height: 100%;"
        @ready="onReady"
      >
        <template #node="slotProps">
          <div
            :style="{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: slotProps.selected ? '#dbeafe' : '#fff',
              border: `2px solid ${slotProps.selected ? '#3b82f6' : '#cbd5e1'}`,
              borderRadius: '8px',
              fontSize: '13px',
              padding: '4px 8px',
              boxSizing: 'border-box',
              cursor: 'default',
            }"
          >
            <textarea
              v-if="slotProps.editing"
              data-editor="true"
              :value="(slotProps.node.data as any)?.content ?? ''"
              @blur="(e) => slotProps.commitText((e.target as HTMLTextAreaElement).value)"
              style="width: 100%; height: 100%; border: none; background: transparent; resize: none; text-align: center; font-size: inherit; outline: none;"
              autofocus
            />
            <span v-else>{{ (slotProps.node.data as any)?.content ?? slotProps.node.id }}</span>
          </div>
        </template>
      </CanvasRoot>
    </main>
  </div>
</template>

<script setup lang="ts">
// All symbols are auto-imported by @canvas/nuxt — no explicit imports needed.
import type { CanvasEngine } from '@canvas/core'

const engine = ref<CanvasEngine | null>(null)
const nodeCount = ref(0)

function onReady(e: CanvasEngine) {
  engine.value = e

  e.createNode({ type: 'text', x: 80, y: 80, width: 160, height: 60, data: { content: 'Hello canvas' } })
  e.createNode({ type: 'text', x: 300, y: 80, width: 160, height: 60, data: { content: 'Drag me' } })
  e.createNode({ type: 'text', x: 190, y: 220, width: 180, height: 60, data: { content: 'Double-click to edit' } })

  nodeCount.value = e.getSnapshot().nodes.length
  e.on('command:after', () => {
    nodeCount.value = e.getSnapshot().nodes.length
  })
}

function addNode() {
  if (!engine.value) return
  const node = engine.value.createNode({
    type: 'text',
    x: 60 + Math.random() * 400,
    y: 60 + Math.random() * 280,
    width: 160,
    height: 60,
    data: { content: 'New node' },
  })
  engine.value.setSelection([node.id])
}

function clearAll() {
  if (!engine.value) return
  const ids = engine.value.getSnapshot().nodes.map((n) => n.id)
  for (const id of ids) {
    engine.value.deleteNode(id)
  }
}
</script>
