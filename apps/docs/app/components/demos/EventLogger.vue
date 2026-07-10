<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
})

const entries = ref<string[]>([])
const unsubscribes: Array<() => void> = []

function push(message: string) {
  entries.value = [
    `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  ${message}`,
    ...entries.value,
  ].slice(0, 18)
}

function seed() {
  engine.importDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'event-a',
          type: 'text',
          x: 70,
          y: 80,
          width: 220,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'event-b',
          type: 'text',
          x: 360,
          y: 200,
          width: 220,
          height: 100,
          text: 'Node',
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
      selection: [],
      nextZIndex: 3,
    }),
    'replace',
  )
}

function addNode() {
  engine.createNode({
    type: 'text',
    x: 120 + Math.round(Math.random() * 320),
    y: 80 + Math.round(Math.random() * 180),
    width: 220,
    height: 110,
    text: 'Node',
  })
}

function deleteSelected() {
  engine.deleteSelected()
}

async function reset() {
  entries.value = []
  seed()
  push('ready')
  await engine.zoomToFit(60, false)
}

onMounted(() => {
  unsubscribes.push(
    engine.on('node:created', (node) => push(`node:created ${node.id}`)),
    engine.on('node:updated', (node) => push(`node:updated ${node.id}`)),
    engine.on('node:deleted', (id) => push(`node:deleted ${id}`)),
    engine.on('selection:change', (selected) =>
      push(`selection:change [${selected.join(', ') || 'none'}]`),
    ),
    engine.on('interaction:start', (state) =>
      push(`interaction:start ${state.mode}`),
    ),
    engine.on('interaction:end', (state) =>
      push(`interaction:end ${state.mode}`),
    ),
    engine.on('command:after', (name) => push(`command:after ${name}`)),
  )
  void reset()
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="reset">Reset</button>
      <button class="demo-primary" @click="addNode">Add node</button>
      <button @click="deleteSelected">Delete selected</button>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <BoardRoot :engine="engine" style="height: 360px" />

      <div
        class="border-t border-default bg-inverted p-4 font-mono text-xs text-primary lg:border-t-0 lg:border-l"
      >
        <p
          class="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary"
        >
          Live event stream
        </p>
        <ul class="mt-3 space-y-2 leading-6">
          <li
            v-for="entry in entries"
            :key="entry"
            class="rounded-md bg-elevated/10 px-3 py-2"
          >
            {{ entry }}
          </li>
          <li
            v-if="entries.length === 0"
            class="rounded-md border border-dashed border-white/10 px-3 py-4 text-dimmed"
          >
            No events yet.
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
