<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue'
import ToolbarButton from './ToolbarButton.vue'
import ToolbarDivider from './ToolbarDivider.vue'

import IconSparkles from '~icons/tabler/sparkles'
import IconSeed from '~icons/tabler/wand'
import IconGrid from '~icons/tabler/grid-dots'
import IconMagnet from '~icons/tabler/magnet'
import IconFit from '~icons/tabler/arrows-maximize'
import IconGroup from '~icons/tabler/layout-grid-add'
import IconImage from '~icons/tabler/photo-plus'
import IconDiagnostics from '~icons/tabler/activity'
import IconMinimap from '~icons/tabler/map-2'
import IconPanel from '~icons/tabler/adjustments-horizontal'

const selectedScene = defineModel<25 | 100 | 500>('selectedScene', {
  required: true,
})
const showGrid = defineModel<boolean>('showGrid', { required: true })
const snapToGrid = defineModel<boolean>('snapToGrid', { required: true })
const showDiagnostics = defineModel<boolean>('showDiagnostics', {
  required: true,
})
const showMinimap = defineModel<boolean>('showMinimap', { required: true })
const showPanel = defineModel<boolean>('showPanel', { required: true })

defineEmits<{
  seed: []
  fit: []
  addImage: []
  wrapGroup: []
}>()
</script>

<template>
  <header
    class="fixed top-2 left-2 right-2 z-50 flex flex-wrap items-center justify-center gap-1 p-1 glass rounded-[14px] shadow-float sm:top-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:flex-nowrap sm:gap-0.5"
  >
    <!-- Brand -->
    <div
      class="group/brand flex items-center gap-[7px] pr-2.5 pl-2 text-sm font-semibold tracking-tight text-[var(--board-fg)] cursor-default select-none"
    >
      <IconSparkles
        class="shrink-0 text-[var(--board-accent)] transition-transform duration-300 ease-spring group-hover/brand:rotate-[20deg]"
        style="width: 15px; height: 15px"
        aria-hidden="true"
      />
      <span>board</span>
    </div>

    <ToolbarDivider />

    <!-- Scene -->
    <div class="flex items-center gap-0.5">
      <select
        v-model="selectedScene"
        class="appearance-none h-10 sm:h-8 pl-2.5 pr-[26px] border-none bg-transparent select-chevron font-sans text-[13px] font-medium text-[var(--board-muted-fg)] rounded-lg cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--board-fg)_6%,transparent)] hover:text-[var(--board-fg)] focus-visible:outline-2 focus-visible:outline-[var(--board-accent)] focus-visible:-outline-offset-1"
        aria-label="Scene size"
      >
        <option :value="25">25 nodes</option>
        <option :value="100">100 nodes</option>
        <option :value="500">500 nodes</option>
      </select>
      <ToolbarButton
        size="icon-text"
        title="Seed the board with sample nodes"
        @click="$emit('seed')"
      >
        <IconSeed style="width: 15px; height: 15px" />
        <span>Seed</span>
      </ToolbarButton>
    </div>

    <ToolbarDivider />

    <!-- Grid / Snap -->
    <div class="flex items-center gap-0.5">
      <ToolbarButton
        size="icon-text"
        :active="showGrid"
        title="Toggle grid"
        @click="showGrid = !showGrid"
      >
        <IconGrid style="width: 15px; height: 15px" />
        <span>Grid</span>
      </ToolbarButton>
      <ToolbarButton
        size="icon-text"
        :active="snapToGrid"
        title="Toggle snap to grid"
        @click="snapToGrid = !snapToGrid"
      >
        <IconMagnet style="width: 15px; height: 15px" />
        <span>Snap</span>
      </ToolbarButton>
    </div>

    <ToolbarDivider />

    <ToolbarButton size="icon-text" title="Zoom to fit" @click="$emit('fit')">
      <IconFit style="width: 15px; height: 15px" />
      <span>Fit</span>
    </ToolbarButton>

    <ToolbarButton
      size="icon-text"
      title="Wrap selected nodes in a group (or add an empty group in view)"
      @click="$emit('wrapGroup')"
    >
      <IconGroup style="width: 15px; height: 15px" />
      <span>Group</span>
    </ToolbarButton>

    <ToolbarDivider />

    <!-- Add image -->
    <ToolbarButton size="square" title="Add image" @click="$emit('addImage')">
      <IconImage style="width: 17px; height: 17px" />
    </ToolbarButton>

    <ToolbarDivider />

    <!-- View toggles -->
    <div class="flex items-center gap-px">
      <ToolbarButton
        size="square"
        :active="showDiagnostics"
        title="Toggle diagnostics"
        @click="showDiagnostics = !showDiagnostics"
      >
        <IconDiagnostics style="width: 17px; height: 17px" />
      </ToolbarButton>

      <ToolbarButton
        size="square"
        :active="showMinimap"
        title="Toggle minimap"
        @click="showMinimap = !showMinimap"
      >
        <IconMinimap style="width: 17px; height: 17px" />
      </ToolbarButton>

      <ToolbarButton
        size="square"
        :active="showPanel"
        title="Toggle settings"
        @click="showPanel = !showPanel"
      >
        <IconPanel style="width: 17px; height: 17px" />
      </ToolbarButton>
    </div>

    <ToolbarDivider />

    <ThemeToggle />
  </header>
</template>
