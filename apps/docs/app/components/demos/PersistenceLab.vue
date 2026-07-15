<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine()
const payload = ref('')
const error = ref('')
const lastImport = ref('Not imported yet')

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: 0, y: 0, z: 1 },
      grid: engine.getGridSettings(),
      selection: [],
      nextZIndex: 3,
      nodes: [
        {
          id: asNodeId('research'),
          type: 'text',
          x: 80,
          y: 90,
          width: 240,
          height: 120,
          text: 'Research customer needs',
          color: '5',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: asNodeId('prototype'),
          type: 'text',
          x: 400,
          y: 170,
          width: 240,
          height: 120,
          text: 'Test the prototype',
          color: '4',
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
    }),
    { mode: 'replace' },
  )
  exportBoard()
  error.value = ''
  lastImport.value = 'Seeded deterministic document'
}

function exportBoard() {
  payload.value = JSON.stringify(engine.exportDocument(), null, 2)
  error.value = ''
}

function importBoard() {
  try {
    const candidate: unknown = JSON.parse(payload.value)
    engine.loadDocument(candidate, { mode: 'replace' })
    payload.value = JSON.stringify(engine.exportDocument(), null, 2)
    error.value = ''
    lastImport.value = 'Validated, normalized, and committed'
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : 'The document is invalid.'
    lastImport.value = 'Rejected; the current board is unchanged'
  }
}

function makeInvalid() {
  payload.value = '{ "nodes": [{ "id": "broken" }] }'
  error.value = ''
}

const result = computed(() => ({
  status: error.value || lastImport.value,
  nodes: engine.getState().nodes.size,
  committedDocumentRemainsUsable: engine.exportDocument().nodes.length > 0,
}))

onMounted(async () => {
  seed()
  await engine.zoomToFit(70, false)
})
</script>

<template>
  <DocsLab
    title="Persistence laboratory"
    description="Unknown input is validated before it can replace the committed document."
    instructions="Load the invalid example, import it, then inspect the board and error. Fix or reset the payload to commit again."
  >
    <template #controls>
      <button type="button" @click="seed">Reset</button>
      <button type="button" @click="makeInvalid">Load invalid JSON</button>
      <button type="button" data-primary="true" @click="importBoard">
        Validate and import
      </button>
      <button type="button" @click="exportBoard">Export</button>
    </template>
    <div class="persistence-lab__stage">
      <BoardRoot :engine="engine" style="height: 360px" />
      <label>
        <span>JSON Canvas document</span>
        <textarea
          v-model="payload"
          spellcheck="false"
          aria-describedby="persistence-error"
        />
      </label>
    </div>
    <template #inspect>
      <StateInspector title="Import result" :value="result" />
      <p
        v-if="error"
        id="persistence-error"
        class="persistence-lab__error"
        role="alert"
      >
        {{ error }}
      </p>
    </template>
    <template #code>
      <CodePreview
        code="const document = engine.exportDocument()\n\n// loadDocument accepts unknown and validates the full boundary.\nengine.loadDocument(candidate, { mode: 'replace' })"
      />
    </template>
  </DocsLab>
</template>

<style scoped>
.persistence-lab__stage {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(16rem, 0.95fr);
}

label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid var(--board-border);
  background: var(--board-bg);
}

label span {
  padding: 0.65rem 0.8rem;
  border-bottom: 1px solid var(--board-border);
  color: var(--board-muted-fg);
  font-size: 0.75rem;
  font-weight: 700;
}

textarea {
  width: 100%;
  min-height: 0;
  flex: 1;
  resize: none;
  border: 0;
  padding: 0.8rem;
  color: var(--board-fg);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  line-height: 1.55;
  outline: none;
}

textarea:focus-visible {
  box-shadow: inset 0 0 0 2px var(--board-accent);
}

.persistence-lab__error {
  margin: 0;
  padding: 0 1rem 1rem;
  color: var(--board-preset-1);
  font-size: 0.8rem;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .persistence-lab__stage {
    grid-template-columns: 1fr;
  }

  label {
    min-height: 20rem;
    border-top: 1px solid var(--board-border);
    border-left: 0;
  }
}
</style>
