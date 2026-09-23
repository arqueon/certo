<script setup lang="ts">
const { t, locale } = useI18n()
const branding = useBranding()
const websiteUrl = useWebsiteUrl()

const pageDescription = computed(() => t('app.description'))
const pageTitle = computed(() => `${branding.name} - ${t('app.title')}`)

// Keep <html lang="..."> in sync with the active locale — important for SEO
// and accessibility (screen readers use this to pick the right voice)
useHead({
  title: () => t('app.title'),
  titleTemplate: `%s | ${branding.name}`,
  htmlAttrs: {
    lang: computed(() => locale.value),
    style: `--brand-primary: ${branding.primaryColor}`,
  },
})

useSeoMeta({
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  ogImage: `${websiteUrl}/og-default.png`,
  ogTitle: () => pageTitle.value,
  ogUrl: websiteUrl,
  twitterCard: 'summary_large_image',
  twitterImage: `${websiteUrl}/og-default.png`,
})
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtLoadingIndicator />
      <NuxtPage />
    </NuxtLayout>
    <SimpleToast />
  </div>
</template>

<style>
html, body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
