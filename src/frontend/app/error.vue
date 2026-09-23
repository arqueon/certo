<script setup lang="ts">
defineProps({
  error: Object
})

const { t } = useI18n()

function handleError() {
  clearError()
  navigateTo(useRoute().path)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#FFE5AE]/20 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full text-center">
      <!-- Error Icon -->
      <div class="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
        <div class="w-12 h-12 i-heroicons-exclamation-triangle text-red-500" />
      </div>

      <!-- Error Message -->
      <h1 class="text-4xl font-bold text-text-primary mb-4">
        {{ error?.statusCode === 404 ? t('errorPage.notFound') : t('errorPage.generic') }}
      </h1>
      <p class="text-text-secondary mb-8">
        {{ error?.statusCode === 404 ? t('errors.notFoundMessage') : (error?.message || t('errorPage.genericMessage')) }}
      </p>

      <!-- Actions -->
      <div class="space-y-4">
        <button
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-white bg-[#00E5C5] hover:bg-[#00E5C5]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5C5]"
          @click="handleError"
        >
          {{ t('common.tryAgain') }}
        </button>
        <NuxtLink
          to="/"
          class="w-full inline-flex justify-center py-2 px-4 border-2 border-[#00E5C5] rounded-full shadow-sm text-[#00E5C5] bg-transparent hover:bg-[#00E5C5]/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5C5]"
        >
          {{ t('errorPage.home') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
