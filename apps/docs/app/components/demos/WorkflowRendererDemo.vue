<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'
import {
  connectionPlugin,
  BoardConnectionLayer,
} from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import WorkflowStepNode from './WorkflowStepNode.vue'

type StepStatus = 'pending' | 'active' | 'done'
interface WorkflowStep {
  id: ReturnType<typeof asNodeId>
  status: StepStatus
  label: string
  summary: string
}

const engine = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'line' },
  extensions: [historyPlugin(), connectionPlugin({ routing: 'step' })],
})

const CAPTURE_ID = asNodeId('capture')
const QUALIFY_ID = asNodeId('qualify')
const HANDOFF_ID = asNodeId('handoff')

function createWorkflowSteps(): WorkflowStep[] {
  return [
    {
      id: CAPTURE_ID,
      status: 'done',
      label: 'Capture lead',
      summary: 'Collect the request and normalize inputs.',
    },
    {
      id: QUALIFY_ID,
      status: 'active',
      label: 'Qualify',
      summary: 'Score, tag, and route the lead.',
    },
    {
      id: HANDOFF_ID,
      status: 'pending',
      label: 'Handoff',
      summary: 'Create the downstream record and alert the owner.',
    },
  ]
}

const workflowSteps = ref<WorkflowStep[]>(createWorkflowSteps())
const stepsByNodeId = computed(
  () => new Map(workflowSteps.value.map((step) => [step.id, step])),
)
const historyState = ref(engine.ext.history.getState())

function syncHistoryState() {
  historyState.value = engine.ext.history.getState()
}

const unsubscribeHistory = [
  engine.on('history:push', syncHistoryState),
  engine.on('history:undo', syncHistoryState),
  engine.on('history:redo', syncHistoryState),
  engine.on('history:clear', syncHistoryState),
]

function seed() {
  workflowSteps.value = createWorkflowSteps()

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
            text: '',
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
            text: '',
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
            text: '',
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
  engine.ext.history.clear()
  syncHistoryState()
}

function nextStatus(current: StepStatus): StepStatus {
  if (current === 'pending') return 'active'
  if (current === 'active') return 'done'
  return 'pending'
}

function advanceSelected() {
  const target = engine.getSelection()[0] ?? QUALIFY_ID
  workflowSteps.value = workflowSteps.value.map((step) =>
    step.id === target ? { ...step, status: nextStatus(step.status) } : step,
  )
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(80, false)
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribeHistory) {
    unsubscribe()
  }
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
        :disabled="historyState.undoDepth === 0"
        @click="engine.ext.history.undo()"
      >
        Undo
      </button>
      <button
        :disabled="historyState.redoDepth === 0"
        @click="engine.ext.history.redo()"
      >
        Redo
      </button>
      <span class="demo-history-badge ml-auto"
        >{{ historyState.undoDepth }} undo /
        {{ historyState.redoDepth }} redo</span
      >
    </div>

    <BoardRoot :engine="engine" style="height: 400px">
      <template #node:text="{ node, selected }">
        <WorkflowStepNode
          :step="stepsByNodeId.get(node.id)"
          :selected="selected"
        />
      </template>
      <BoardConnectionLayer routing="step" />
    </BoardRoot>
  </div>
</template>
