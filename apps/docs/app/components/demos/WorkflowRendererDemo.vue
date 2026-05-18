<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'
import {
  connectionPlugin,
  BoardConnectionLayer,
} from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import WorkflowStepNode from './WorkflowStepNode.vue'

type StepStatus = 'pending' | 'active' | 'done'

const engine = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'line' },
  extensions: [historyPlugin(), connectionPlugin({ routing: 'step' })],
})

const renderers: BoardRendererRegistry = {
  text: WorkflowStepNode,
}

const historyState = computed(() => engine.ext.history.getState())
const CAPTURE_ID = asNodeId('capture')
const QUALIFY_ID = asNodeId('qualify')
const HANDOFF_ID = asNodeId('handoff')

function seed() {
  engine.importJSON(
    JSON.stringify(
      createDemoDocument({
        camera: { x: -40, y: -30, z: 1 },
        grid: engine.getGridSettings(),
        selection: [],
        nextZIndex: 4,
        nodes: [
          {
            id: CAPTURE_ID,
            type: 'text',
            x: 40,
            y: 110,
            width: 220,
            height: 130,
            text: 'done\nCapture lead\nCollect the request and normalize inputs.',
            zIndex: 1,
            locked: false,
            visible: true,
          },
          {
            id: QUALIFY_ID,
            type: 'text',
            x: 340,
            y: 110,
            width: 220,
            height: 130,
            text: 'active\nQualify\nScore, tag, and route the lead.',
            zIndex: 2,
            locked: false,
            visible: true,
          },
          {
            id: HANDOFF_ID,
            type: 'text',
            x: 640,
            y: 110,
            width: 220,
            height: 130,
            text: 'pending\nHandoff\nCreate the downstream record and alert the owner.',
            zIndex: 3,
            locked: false,
            visible: true,
          },
        ],
      }),
    ),
    'replace',
  )

  for (const edge of engine.ext.connections.getEdges()) {
    engine.ext.connections.deleteEdge(edge.id)
  }

  engine.ext.connections.createEdge({
    from: CAPTURE_ID,
    to: QUALIFY_ID,
    label: 'validated',
    data: {},
  })
  engine.ext.connections.createEdge({
    from: QUALIFY_ID,
    to: HANDOFF_ID,
    label: 'approved',
    data: {},
  })
}

function nextStatus(current: StepStatus): StepStatus {
  if (current === 'pending') return 'active'
  if (current === 'active') return 'done'
  return 'pending'
}

function advanceSelected() {
  const selected = engine.getSelection()[0]
  const target = selected ?? QUALIFY_ID
  const node = engine.getNode(target)
  if (!node || node.type !== 'text') {
    return
  }
  const [, label = '', summary = ''] = (node.text ?? '').split('\n')
  engine.updateNode(node.id, {
    text: `${nextStatus(parseStepStatus(node.text))}\n${label}\n${summary}`,
  })
}

function parseStepStatus(text: string | undefined): StepStatus {
  const status = text?.split('\n')[0]
  return status === 'active' || status === 'done' ? status : 'pending'
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(80, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">Reset</button>
      <button class="demo-primary" @click="advanceSelected">
        Cycle selected step
      </button>
      <button
        :disabled="!engine.ext.history.canUndo()"
        @click="engine.ext.history.undo()"
      >
        Undo
      </button>
      <button
        :disabled="!engine.ext.history.canRedo()"
        @click="engine.ext.history.redo()"
      >
        Redo
      </button>
      <span class="demo-history-badge ml-auto"
        >{{ historyState.undoDepth }} undo /
        {{ historyState.redoDepth }} redo</span
      >
    </div>

    <BoardRoot :engine="engine" :renderers="renderers" style="height: 400px">
      <BoardConnectionLayer routing="step" />
    </BoardRoot>
  </div>
</template>
