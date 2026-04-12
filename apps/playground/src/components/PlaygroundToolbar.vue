<script setup lang="ts">
const selectedScene = defineModel<25 | 100 | 500>('selectedScene', { required: true })
const showGrid = defineModel<boolean>('showGrid', { required: true })
const snapToGrid = defineModel<boolean>('snapToGrid', { required: true })
const showDiagnostics = defineModel<boolean>('showDiagnostics', { required: true })
const showMinimap = defineModel<boolean>('showMinimap', { required: true })
const showPanel = defineModel<boolean>('showPanel', { required: true })

const emit = defineEmits<{
  seed: []
  fit: []
  addImage: []
  wrapGroup: []
}>()

const btn = 'flex items-center justify-center h-8 px-3 border-none font-sans text-[13px] font-medium rounded-[10px] cursor-pointer whitespace-nowrap transition-colors active:scale-[0.97]'
const btnOff = 'bg-transparent text-stone-600 hover:bg-black/5 hover:text-stone-900'
const btnOn = 'bg-stone-900 text-white hover:bg-stone-800'
const sq = 'flex items-center justify-center w-8 h-8 border-none font-sans rounded-[10px] cursor-pointer transition-colors active:scale-[0.97]'
</script>

<template>
  <header
    class="fixed top-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-0.5 p-1 glass border border-black/6 rounded-[14px] shadow-float"
  >
    <!-- Brand -->
    <div
      class="group flex items-center gap-[7px] pr-2.5 pl-2 text-sm font-semibold tracking-tight text-stone-900 cursor-default select-none"
    >
      <svg
        class="shrink-0 text-teal-600 transition-transform duration-300 ease-spring group-hover:rotate-90"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
      >
        <rect x="2.5" y="2.5" width="9" height="9" rx="2" transform="rotate(45 7 7)" fill="currentColor" />
      </svg>
      <span>canvas</span>
    </div>

    <i class="block w-px h-5 mx-0.5 bg-black/12 shrink-0" aria-hidden="true" />

    <!-- Scene -->
    <div class="flex items-center gap-0.5">
      <select
        v-model="selectedScene"
        class="appearance-none h-8 pl-2.5 pr-[26px] border-none bg-transparent select-chevron font-sans text-[13px] font-medium text-stone-600 rounded-[10px] cursor-pointer transition-colors hover:bg-black/5 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:-outline-offset-1"
        aria-label="Scene size"
      >
        <option :value="25">25 nodes</option>
        <option :value="100">100 nodes</option>
        <option :value="500">500 nodes</option>
      </select>
      <button :class="[btn, btnOff]" @click="emit('seed')">Seed</button>
    </div>

    <i class="block w-px h-5 mx-0.5 bg-black/12 shrink-0" aria-hidden="true" />

    <!-- Grid / Snap -->
    <div class="flex items-center gap-0.5">
      <button :class="[btn, showGrid ? btnOn : btnOff]" @click="showGrid = !showGrid">Grid</button>
      <button :class="[btn, snapToGrid ? btnOn : btnOff]" @click="snapToGrid = !snapToGrid">Snap</button>
    </div>

    <i class="block w-px h-5 mx-0.5 bg-black/12 shrink-0" aria-hidden="true" />

    <button :class="[btn, btnOff]" @click="emit('fit')">Fit</button>

    <button
      type="button"
      :class="[btn, btnOff]"
      title="Wrap selected nodes in a group (or add an empty group in view if nothing is selected)"
      @click="emit('wrapGroup')"
    >
      Group
    </button>

    <i class="block w-px h-5 mx-0.5 bg-black/12 shrink-0" aria-hidden="true" />

    <!-- Add image -->
    <button :class="[sq, btnOff]" title="Add image" @click="emit('addImage')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
        <circle cx="5.5" cy="6.5" r="1" />
        <path d="M1.5 11l3.5-3.5 2.5 2.5 2-2 4 4" />
      </svg>
    </button>

    <i class="block w-px h-5 mx-0.5 bg-black/12 shrink-0" aria-hidden="true" />

    <!-- View toggles -->
    <div class="flex items-center gap-px">
      <button
        :class="[sq, showDiagnostics ? btnOn : btnOff]"
        title="Toggle diagnostics"
        @click="showDiagnostics = !showDiagnostics"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M5 6.5l2 1.5-2 1.5" />
          <line x1="9" y1="10" x2="11" y2="10" />
        </svg>
      </button>

      <button
        :class="[sq, showMinimap ? btnOn : btnOff]"
        title="Toggle minimap"
        @click="showMinimap = !showMinimap"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <rect x="9" y="8.5" width="3.5" height="3" rx="0.5" fill="currentColor" opacity="0.3" stroke="none" />
        </svg>
      </button>

      <button
        :class="[sq, showPanel ? btnOn : btnOff]"
        title="Toggle settings"
        @click="showPanel = !showPanel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="10" y1="3" x2="10" y2="13" />
        </svg>
      </button>
    </div>
  </header>
</template>
