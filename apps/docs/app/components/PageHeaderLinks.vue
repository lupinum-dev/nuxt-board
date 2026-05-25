<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const route = useRoute()
const toast = useToast()
const { copy, copied } = useClipboard()
const { public: publicConfig } = useRuntimeConfig()

const contentPath = computed(() =>
  route.path === '/' ? '/' : route.path.replace(/\/$/, ''),
)
const rawPath = computed(() =>
  contentPath.value === '/' ? '/raw/index.md' : `/raw${contentPath.value}.md`,
)
const mdPath = computed(() => new URL(rawPath.value, publicConfig.siteUrl).href)
const chatGptHref = computed(
  () =>
    `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${mdPath.value} so I can ask questions about it.`)}`,
)
const claudeHref = computed(
  () =>
    `https://claude.ai/new?q=${encodeURIComponent(`Read ${mdPath.value} so I can ask questions about it.`)}`,
)

function copyMarkdownLink() {
  copy(mdPath.value)
  toast.add({
    title: 'Copied to clipboard',
    icon: 'i-lucide-check-circle',
  })
}

const actionItems = computed(() => [
  {
    label: 'Copy Markdown link',
    icon: 'i-lucide-link',
    onSelect: copyMarkdownLink,
  },
  {
    label: 'View as Markdown',
    icon: 'i-simple-icons:markdown',
    target: '_blank',
    to: rawPath.value,
  },
  {
    label: 'Open in ChatGPT',
    icon: 'i-simple-icons:openai',
    target: '_blank',
    rel: 'noopener noreferrer',
    to: chatGptHref.value,
  },
  {
    label: 'Open in Claude',
    icon: 'i-simple-icons:anthropic',
    target: '_blank',
    rel: 'noopener noreferrer',
    to: claudeHref.value,
  },
])

async function copyPage() {
  copy(await $fetch<string>(rawPath.value))
}
</script>

<template>
  <UFieldGroup>
    <UButton
      label="Copy page"
      :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
      color="neutral"
      variant="outline"
      :ui="{
        leadingIcon: [copied ? 'text-primary' : 'text-neutral', 'size-3.5'],
      }"
      @click="copyPage"
    />
    <UDropdownMenu
      :items="actionItems"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8,
      }"
      :ui="{
        content: 'w-48',
      }"
    >
      <UButton
        icon="i-lucide-chevron-down"
        size="sm"
        color="neutral"
        variant="outline"
        data-testid="page-actions-menu"
        aria-label="Open copy actions menu"
      />
    </UDropdownMenu>
  </UFieldGroup>
</template>
