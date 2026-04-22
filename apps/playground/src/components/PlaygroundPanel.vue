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
  'flex-1 py-2 px-3.5 border border-black/12 bg-transparent font-sans text-[13px] font-medium text-stone-900 rounded-lg cursor-pointer transition-colors hover:bg-black/[0.03] hover:border-stone-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:-outline-offset-1'
</script>

<template>
  <aside
    class="fixed top-[68px] right-4 z-40 w-[264px] flex flex-col glass border border-black/6 rounded-xl shadow-float max-h-[calc(100vh-84px)] overflow-y-auto overscroll-contain panel-scroll pointer-events-auto"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-3.5">
      <h2 class="text-[13px] font-semibold tracking-tight text-stone-900">
        Settings
      </h2>
      <button
        class="flex items-center justify-center w-6 h-6 border-none bg-transparent text-stone-400 rounded-md cursor-pointer transition-colors hover:bg-black/5 hover:text-stone-900"
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
    <div class="divide-y divide-black/6">
      <!-- Grid -->
      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.06em] uppercase text-stone-400 mb-0.5"
        >
          Grid
        </h3>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="text-[13px] text-stone-600">Size</span>
          <select
            v-model="gridSize"
            class="appearance-none w-[110px] py-1.5 pl-2.5 pr-7 border border-black/12 bg-white select-chevron font-sans text-[13px] text-stone-900 rounded-lg cursor-pointer transition-[border-color] hover:border-stone-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          >
            <option :value="10">10 px</option>
            <option :value="20">20 px</option>
            <option :value="40">40 px</option>
          </select>
        </label>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="text-[13px] text-stone-600">Pattern</span>
          <select
            v-model="gridPattern"
            class="appearance-none w-[110px] py-1.5 pl-2.5 pr-7 border border-black/12 bg-white select-chevron font-sans text-[13px] text-stone-900 rounded-lg cursor-pointer transition-[border-color] hover:border-stone-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          >
            <option value="line">Line</option>
            <option value="dot">Dot</option>
            <option value="cross">Cross</option>
            <option value="none">None</option>
          </select>
        </label>
      </section>

      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.06em] uppercase text-stone-400 mb-0.5"
        >
          Connections
        </h3>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="text-[13px] text-stone-600">Style</span>
          <select
            v-model="connectionRouting"
            class="appearance-none w-[110px] py-1.5 pl-2.5 pr-7 border border-black/12 bg-white select-chevron font-sans text-[13px] text-stone-900 rounded-lg cursor-pointer transition-[border-color] hover:border-stone-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          >
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
          class="font-mono text-[10px] font-medium tracking-[0.06em] uppercase text-stone-400 mb-0.5"
        >
          Benchmark
        </h3>
        <button :class="pbtn" @click="emit('benchmark')">Run benchmark</button>
        <p
          class="font-mono text-[11px] leading-relaxed text-stone-400 break-all"
        >
          {{ benchmarkResult }}
        </p>
      </section>

      <!-- Data -->
      <section class="flex flex-col gap-2 px-4 py-3.5">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.06em] uppercase text-stone-400 mb-0.5"
        >
          Data
        </h3>
        <div class="flex gap-1.5">
          <button :class="pbtn" @click="emit('export')">Export</button>
          <button :class="pbtn" @click="emit('import')">Import</button>
        </div>
        <pre
          v-if="exportedJson"
          class="p-2.5 bg-black/[0.025] rounded-lg font-mono text-[11px] leading-snug text-stone-400 whitespace-pre-wrap break-all max-h-[140px] overflow-y-auto"
          >{{ exportedJson.slice(0, 300) }}</pre
        >
      </section>

      <!-- Shortcuts -->
      <section class="flex flex-col gap-2 px-4 py-3.5 pb-4">
        <h3
          class="font-mono text-[10px] font-medium tracking-[0.06em] uppercase text-stone-400 mb-0.5"
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
              class="text-xs text-stone-600 whitespace-nowrap"
              v-html="shortcut.keys"
            />
            <dd class="text-xs text-stone-400 text-right">
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
  `<kbd class="inline-block py-px px-1 bg-black/[0.04] border border-black/6 rounded font-mono text-[10px] leading-relaxed text-stone-600">${label}</kbd>`

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
