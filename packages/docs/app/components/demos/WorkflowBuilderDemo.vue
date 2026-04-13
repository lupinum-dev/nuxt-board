<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { createBoardEngine, type NodeId } from '@lupinum/board-core'
import { connectionPlugin, BoardConnectionLayer } from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import WorkflowStepNode from './WorkflowStepNode.vue'

type StepStatus = 'pending' | 'active' | 'done'

const engine = createBoardEngine({
  grid: { size: 24, majorEvery: 4, snap: true, pattern: 'line' },
  plugins: [historyPlugin(), connectionPlugin({ routing: 'step' })]
})

const renderers: BoardRendererRegistry = {
  step: WorkflowStepNode
}

const historyState = computed(() => engine.ext.history.getState())

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: -40, y: -30, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'capture', type: 'step', x: 40, y: 110, width: 220, height: 130, data: { label: 'Capture lead', summary: 'Collect the request and normalize inputs.', status: 'done' }, zIndex: 1, locked: false, visible: true },
      { id: 'qualify', type: 'step', x: 340, y: 110, width: 220, height: 130, data: { label: 'Qualify', summary: 'Score, tag, and route the lead.', status: 'active' }, zIndex: 2, locked: false, visible: true },
      { id: 'handoff', type: 'step', x: 640, y: 110, width: 220, height: 130, data: { label: 'Handoff', summary: 'Create the downstream record and alert the owner.', status: 'pending' }, zIndex: 3, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 4
  }), 'replace')

  for (const edge of engine.ext.connections.getEdges()) {
    engine.ext.connections.deleteEdge(edge.id)
  }

  engine.ext.connections.createEdge({ from: 'capture' as NodeId, to: 'qualify' as NodeId, label: 'validated', data: {} })
  engine.ext.connections.createEdge({ from: 'qualify' as NodeId, to: 'handoff' as NodeId, label: 'approved', data: {} })
}

function nextStatus(current: StepStatus): StepStatus {
  if (current === 'pending') return 'active'
  if (current === 'active') return 'done'
  return 'pending'
}

function advanceSelected() {
  const selected = engine.getSelection()[0]
  const target = selected ?? ('qualify' as NodeId)
  const node = engine.getNode(target)
  if (!node || node.type !== 'step') {
    return
  }
  engine.updateNode(node.id, {
    data: {
      ...node.data,
      status: nextStatus(node.data.status as StepStatus)
    }
  })
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(80, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button @click="seed">
        Reset workflow
      </button>
      <button @click="advanceSelected">
        Cycle selected step
      </button>
      <button :disabled="!engine.ext.history.canUndo()" @click="engine.ext.history.undo()">
        Undo
      </button>
      <button :disabled="!engine.ext.history.canRedo()" @click="engine.ext.history.redo()">
        Redo
      </button>
      <span class="ml-auto text-xs font-mono text-slate-500">undo {{ historyState.undoDepth }} / redo {{ historyState.redoDepth }}</span>
    </div>

    <BoardRoot
      :engine="engine"
      :renderers="renderers"
      style="height: 400px"
    >
      <BoardConnectionLayer routing="step" />
    </BoardRoot>
  </div>
</template>
