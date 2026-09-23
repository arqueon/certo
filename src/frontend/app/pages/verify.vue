<script setup lang="ts">
const websiteUrl = useWebsiteUrl()
const { t } = useI18n()
const branding = useBranding()
const pageDescription = computed(() => t('verifyPage.seoDescription', { brand: branding.name }))
// Texts are read from the translations on every render (they follow the
// locale); only the open/closed state lives here.
const faqOpen = ref<boolean[]>([false, false, false, false, false])
const faqs = computed(() => [1, 2, 3, 4, 5].map(n => ({
  question: t(`verifyPage.faq.q${n}`),
  answer: t(`verifyPage.faq.a${n}`, { brand: branding.name }),
})))

useSeoMeta({
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  ogUrl: `${websiteUrl}/verify`
})

useHead({
  title: () => t('verify.title'),
  link: [
    { rel: 'canonical', href: `${websiteUrl}/verify` }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#FFE5AE]/20 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('verify.title') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('verify.subtitle') }}
        </p>
      </div>

      <!-- Main Content -->
      <div class="max-w-3xl mx-auto">
        <BadgeVerifier />
      </div>

      <!-- Features -->
      <div class="mt-16">
        <h2 class="text-2xl font-bold text-text-primary text-center mb-8">
          {{ t('verify.whyVerify') }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="w-12 h-12 bg-[#00E5C5]/10 rounded-full flex items-center justify-center mb-4">
              <div class="w-6 h-6 i-heroicons-cube-transparent text-[#5AB69F]" />
            </div>
            <h3 class="text-lg font-medium text-text-primary mb-2">
              Open Badges 3.0
            </h3>
            <p class="text-text-secondary">
              {{ t('verifyPage.ob3Desc') }}
            </p>
          </div>

          <!-- Instant Results -->
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="w-12 h-12 bg-[#00E5C5]/10 rounded-full flex items-center justify-center mb-4">
              <div class="w-6 h-6 i-heroicons-bolt text-[#5AB69F]" />
            </div>
            <h3 class="text-lg font-medium text-text-primary mb-2">
              {{ t('verifyPage.instantTitle') }}
            </h3>
            <p class="text-text-secondary">
              {{ t('verifyPage.instantDesc') }}
            </p>
          </div>

          <!-- Multiple Formats -->
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="w-12 h-12 bg-[#00E5C5]/10 rounded-full flex items-center justify-center mb-4">
              <div class="w-6 h-6 i-heroicons-document-duplicate text-[#5AB69F]" />
            </div>
            <h3 class="text-lg font-medium text-text-primary mb-2">
              {{ t('verifyPage.formatsTitle') }}
            </h3>
            <p class="text-text-secondary">
              {{ t('verifyPage.formatsDesc') }}
            </p>
          </div>
        </div>
      </div>

      <!-- FAQ Section -->
      <div class="mt-16">
        <h3 class="text-lg font-medium text-text-primary mb-2">
          {{ t('verifyPage.faqTitle') }}
        </h3>

        <div class="max-w-3xl mx-auto space-y-4">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden"
          >
            <button
              class="w-full px-6 py-4 text-left flex items-center justify-between"
              :aria-expanded="faqOpen[index]"
              @click="faqOpen[index] = !faqOpen[index]"
            >
              <span class="font-medium text-text-primary">{{ faq.question }}</span>
              <div
                class="w-5 h-5 transform transition-transform"
                :class="[faqOpen[index] ? 'rotate-180' : '']"
              >
                <div class="w-5 h-5 i-heroicons-chevron-down text-[#00E5C5]" />
              </div>
            </button>
            <div
              v-show="faqOpen[index]"
              class="px-6 pb-4 text-text-secondary"
            >
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
