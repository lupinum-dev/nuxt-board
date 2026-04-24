<script setup lang="ts">
import { useBoardTheme } from '../composables/useBoardTheme'
import ToolbarButton from './ToolbarButton.vue'
import IconSun from '~icons/tabler/sun-high'
import IconMoon from '~icons/tabler/moon-stars'

const { theme, toggle } = useBoardTheme()
</script>

<template>
  <ToolbarButton
    size="square"
    :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    :aria-label="
      theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    "
    @click="toggle"
  >
    <IconSun v-if="theme === 'dark'" style="width: 17px; height: 17px" />
    <IconMoon v-else style="width: 17px; height: 17px" />
  </ToolbarButton>
</template>
