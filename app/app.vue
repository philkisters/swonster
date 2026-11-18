<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>

<script setup lang="ts">
const { app } = useRuntimeConfig()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#000000' },
    { name: 'application-name', content: 'Swonster' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Swonster' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'msapplication-config', content: `${app.baseURL}browserconfig.xml` },
    { name: 'msapplication-TileColor', content: '#000000' },
    { name: 'msapplication-TileImage', content: `${app.baseURL}mstile-150x150.png` }
  ],
  link: [
    { rel: 'icon', href: `${app.baseURL}favicon.ico`, sizes: 'any' },
    { rel: 'icon', type: 'image/png', href: `${app.baseURL}favicon-32x32.png`, sizes: '32x32' },
    { rel: 'icon', type: 'image/png', href: `${app.baseURL}favicon-16x16.png`, sizes: '16x16' },
    { rel: 'apple-touch-icon', href: `${app.baseURL}apple-touch-icon.png`, sizes: '180x180' },
    { rel: 'manifest', href: `${app.baseURL}site.webmanifest` }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Swonster — Monster Merge'
const description = 'Slide monsters across the board and merge matching creatures.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogImage: `${app.baseURL}logo.png`,
  ogImageAlt: 'Swonster dragon logo',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: `${app.baseURL}logo.png`,
  twitterImageAlt: 'Swonster dragon logo'
})
</script>
