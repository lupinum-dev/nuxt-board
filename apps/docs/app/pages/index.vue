<script setup lang="ts">
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { data: page } = await useAsyncData('index', () =>
  queryCollection('landing').path('/').first(),
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true,
  })
}

const title = page.value.seo?.title || page.value.title
const description = page.value.seo?.description || page.value.description

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogUrl: new URL(route.path, runtimeConfig.public.siteUrl).href,
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: new URL(route.path, runtimeConfig.public.siteUrl).href,
    },
  ],
})
</script>

<template>
  <ContentRenderer v-if="page" :value="page" :prose="false" />
</template>
