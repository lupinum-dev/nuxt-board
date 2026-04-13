<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createBoardEngine, findContainingGroup, type NodeId } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'

const engine = createBoardEngine({
  grid: { size: 16, majorEvery: 4, snap: true, pattern: 'line' },
  plugins: [historyPlugin({ debounceMs: 0 })]
})

const selection = ref<NodeId[]>([])
const selectedCard = computed(() => {
  const id = selection.value[0]
  if (!id) return null
  const node = engine.getNode(id)
  return node?.type === 'text' ? node : null
})

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: -20, y: -20, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'todo', type: 'group', x: 0, y: 0, width: 280, height: 560, data: { title: 'To Do' }, zIndex: 1, locked: false, visible: true },
      { id: 'doing', type: 'group', x: 320, y: 0, width: 280, height: 560, data: { title: 'Doing' }, zIndex: 2, locked: false, visible: true },
      { id: 'done', type: 'group', x: 640, y: 0, width: 280, height: 560, data: { title: 'Done' }, zIndex: 3, locked: false, visible: true },
      { id: 'card-a', type: 'text', x: 16, y: 70, width: 248, height: 88, data: { content: 'Draft onboarding copy' }, parentId: 'todo', zIndex: 4, locked: false, visible: true },
      { id: 'card-b', type: 'text', x: 16, y: 180, width: 248, height: 88, data: { content: 'Ship audit logs' }, parentId: 'todo', zIndex: 5, locked: false, visible: true },
      { id: 'card-c', type: 'text', x: 336, y: 70, width: 248, height: 88, data: { content: 'QA export flow' }, parentId: 'doing', zIndex: 6, locked: false, visible: true },
      { id: 'card-d', type: 'text', x: 656, y: 70, width: 248, height: 88, data: { content: 'Publish release notes' }, parentId: 'done', zIndex: 7, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 8
  }), 'replace')
  engine.sendToBack('todo' as NodeId)
  engine.sendToBack('doing' as NodeId)
  engine.sendToBack('done' as NodeId)
}

function addCard() {
  engine.createNode({
    type: 'text',
    x: 20,
    y: 300,
    width: 248,
    height: 88,
    data: { content: 'New card\nDrag between columns' },
    parentId: 'todo' as NodeId
  })
}

engine.on('node:moved', (node) => {
  if (node.type !== 'text') {
    return
  }
  const nextParent = findContainingGroup(node, engine.getState().nodes)
  if (nextParent !== node.parentId) {
    engine.updateNode(node.id, { parentId: nextParent })
  }
})

onMounted(async () => {
  engine.on('selection:change', (next) => {
    selection.value = next
  })
  seed()
  await engine.zoomToFit(72, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="seed">
        Reset board
      </button>
      <button @click="addCard">
        Add card
      </button>
      <button @click="engine.zoomToFit(72, false)">
        Zoom to fit
      </button>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
      <BoardRoot :engine="engine" style="height: 420px" />

      <div class="border-t border-slate-200/80 bg-white/80 p-4 lg:border-t-0 lg:border-l">
        <p class="text-sm font-semibold text-slate-900">
          Selected card
        </p>
        <div class="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4">
          <p v-if="selectedCard" class="text-sm font-medium text-slate-900">
            {{ selectedCard.data.content }}
          </p>
          <p v-if="selectedCard" class="mt-3 text-xs text-slate-500">
            <span class="font-semibold text-slate-700">parentId:</span> {{ selectedCard.parentId ?? 'none' }}
          </p>
          <p v-else class="text-sm text-slate-500">
            Select a card, then drag it to another column to watch `parentId` update.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
