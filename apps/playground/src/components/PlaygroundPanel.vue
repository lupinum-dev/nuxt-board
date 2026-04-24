<script setup lang="ts">
import type { ConnectionRouting } from '@lupinum/board-connections'

const gridSize = defineModel<10 | 20 | 40>('gridSize', { required: true })
const gridPattern = defineModel<'line' | 'dot' | 'cross' | 'none'>(
  'gridPattern',
  { required: true },
)
const connectionRouting = defineModel<ConnectionRouting>('connectionRouting', {
  required: true,
})

defineProps<{
  benchmarkResult: string
  exportedJson: string
}>()

const emit = defineEmits<{
  close: []
  benchmark: []
  export: []
  import: []
}>()

const pbtn =
  'flex-1 min-w-0 min-h-10 py-2 px-3.5 border border-[var(--board-border)] bg-transparent font-sans text-[13px] font-medium text-[var(--board-fg)] rounded-lg cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--board-fg)_4%,transparent)] hover:border-[var(--board-border-strong)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--board-accent)] focus-visible:-outline-offset-1'

const pselect =
  'appearance-none min-h-10 w-[110px] shrink-0 py-1.5 pl-2.5 pr-7 border border-[var(--board-border)] bg-[var(--board-bg-elevated)] select-chevron font-sans text-[13px] text-[var(--board-fg)] rounded-lg cursor-pointer transition-[border-color] duration-150 hover:border-[var(--board-border-strong)] focus:outline-none focus:border-[var(--board-accent)] focus:ring-2 focus:ring-[var(--board-accent-ring)]'
</script>

<template>
  <aside
    class="playground-panel fixed z-40 flex flex-col glass rounded-xl shadow-float overflow-y-auto overflow-x-hidden overscroll-contain panel-scroll pointer-events-auto"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-3.5">
      <h2
        class="text-[13px] font-semibold tracking-tight text-[var(--board-fg)]"
      >
        Settings
      </h2>
      <button
        class="flex items-center justify-center w-9 h-9 sm:w-6 sm:h-6 border-none bg-transparent text-[var(--board-dim-fg)] rounded-md cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--board-fg)_6%,transparent)] hover:text-[var(--board-fg)]"
        aria-label="Close settings"
        @click="emit('close')"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
        </svg>
      </button>
    </div>

    <!-- Sections -->
    <div class="divide-y divide-[var(--board-divider)]">
      <!-- Grid -->
      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--board-dim-fg)] mb-0.5"
        >
          Grid
        </h3>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="min-w-0 text-[13px] text-[var(--board-muted-fg)]"
            >Size</span
          >
          <select v-model="gridSize" :class="pselect">
            <option :value="10">10 px</option>
            <option :value="20">20 px</option>
            <option :value="40">40 px</option>
          </select>
        </label>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="min-w-0 text-[13px] text-[var(--board-muted-fg)]"
            >Pattern</span
          >
          <select v-model="gridPattern" :class="pselect">
            <option value="line">Line</option>
            <option value="dot">Dot</option>
            <option value="cross">Cross</option>
            <option value="none">None</option>
          </select>
        </label>
      </section>

      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--board-dim-fg)] mb-0.5"
        >
          Connections
        </h3>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="min-w-0 text-[13px] text-[var(--board-muted-fg)]"
            >Style</span
          >
          <select v-model="connectionRouting" :class="pselect">
            <option value="bezier">Curve</option>
            <option value="smooth-step">Angled smooth</option>
            <option value="step">Angled</option>
            <option value="straight">Straight</option>
            <option value="arc">Arc</option>
          </select>
        </label>
      </section>

      <!-- Benchmark -->
      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--board-dim-fg)] mb-0.5"
        >
          Benchmark
        </h3>
        <button :class="pbtn" @click="emit('benchmark')">Run benchmark</button>
        <p
          class="font-mono text-[11px] leading-relaxed text-[var(--board-dim-fg)] break-all"
        >
          {{ benchmarkResult }}
        </p>
      </section>

      <!-- Data -->
      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--board-dim-fg)] mb-0.5"
        >
          Data
        </h3>
        <div class="flex min-w-0 gap-1.5">
          <button :class="pbtn" @click="emit('export')">Export</button>
          <button :class="pbtn" @click="emit('import')">Import</button>
        </div>
        <pre
          v-if="exportedJson"
          class="p-2.5 bg-[var(--board-bg-subtle)] border border-[var(--board-border)] rounded-lg font-mono text-[11px] leading-snug text-[var(--board-muted-fg)] whitespace-pre-wrap break-all max-h-[140px] overflow-y-auto"
          >{{ exportedJson.slice(0, 300) }}</pre
        >
      </section>

      <!-- Shortcuts -->
      <section class="flex flex-col gap-2 px-4 py-3.5 pb-4">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--board-dim-fg)] mb-0.5"
        >
          Shortcuts
        </h3>
        <dl class="flex flex-col gap-[5px]">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.keys"
            class="flex items-center justify-between gap-3"
          >
            <dt
              class="text-xs text-[var(--board-muted-fg)] whitespace-nowrap"
              v-html="shortcut.keys"
            />
            <dd class="min-w-0 text-xs text-[var(--board-dim-fg)] text-right">
              {{ shortcut.action }}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </aside>
</template>

<script lang="ts">
const kbd = (label: string) =>
  `<kbd class="inline-block py-px px-1 bg-[var(--board-bg-subtle)] border border-[var(--board-border)] rounded font-mono text-[10px] leading-relaxed text-[var(--board-muted-fg)]">${label}</kbd>`

const shortcuts = [
  { keys: 'Double-click', action: 'Create node' },
  { keys: 'Space + drag', action: 'Pan board' },
  { keys: `${kbd('Ctrl')} ${kbd('A')}`, action: 'Select all' },
  { keys: `${kbd('Ctrl')} ${kbd('D')}`, action: 'Duplicate' },
  { keys: `${kbd('Ctrl')} ${kbd('Z')} / ${kbd('Y')}`, action: 'Undo / Redo' },
  { keys: `${kbd('Ctrl')} ${kbd('C')} / ${kbd('V')}`, action: 'Copy / Paste' },
  { keys: `${kbd('Ctrl')} ${kbd('0')}`, action: 'Reset zoom' },
  { keys: `${kbd('Ctrl')} ${kbd('1')}`, action: 'Zoom to fit' },
  { keys: kbd('Del'), action: 'Delete' },
  { keys: 'Arrows', action: 'Nudge selection' },
]
</script>

<style scoped>
.playground-panel {
  top: 116px;
  right: 0.5rem;
  left: 0.5rem;
  max-height: calc(100vh - 124px);
}

@media (min-width: 640px) {
  .playground-panel {
    top: 68px;
    right: 1rem;
    left: auto;
    width: min(264px, calc(100vw - 2rem));
    max-height: calc(100vh - 84px);
  }
}
</style>
