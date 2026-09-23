<script setup lang="ts">
const websiteUrl = useWebsiteUrl()
const { t } = useI18n()
const router = useRouter()
const email = ref('')
const password = ref('')
const authStore = ref(null)
const isStoreReady = ref(false)
const authError = ref(null)
const isLoading = ref(false)
const pageDescription = computed(() => t('auth.seoDescription'))

// OAuth / OIDC providers offered on this page, from NUXT_PUBLIC_OAUTH_PROVIDERS
// (comma-separated users-permissions provider names). Read through
// runtimeConfig so it can be changed without rebuilding the image.
const config = useRuntimeConfig()
const branding = useBranding()

const oauthProviders = computed(() =>
  String(config.public.oauthProviders || '')
    .split(',')
    .map((p: string) => p.trim())
    .filter(Boolean)
)

const apiBaseUrl = config.public.apiUrl || 'http://localhost:1337'

// With an identity provider configured, signing in with the institutional
// account is the path a credential holder should take; the local form stays
// available for service and administrative accounts.
const showLocalForm = ref(false)

function startOAuth(provider: string) {
  // Redirect to Strapi's users-permissions connect endpoint, which
  // redirects to the provider, then back to /auth/callback with
  // ?access_token=<jwt> (see docs/oauth-setup.md).
  window.location.href = `${apiBaseUrl}/api/connect/${provider}`
}

useSeoMeta({
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
})

useHead({
  title: () => t('auth.signInTitle'),
  link: [
    { rel: 'canonical', href: `${websiteUrl}/login` }
  ]
})

async function handleSubmit() {
  if (!isStoreReady.value || !authStore.value) {
    authError.value = t('auth.notReady')
    return
  }

  if (email.value && password.value) {
    isLoading.value = true
    authError.value = null

    try {
      const success = await authStore.value.login(email.value, password.value)

      if (success) {
        router.push('/dashboard')
      }
      else {
        authError.value = authStore.value.error
      }
    }
    catch (error) {
      console.error('Login error:', error)
      authError.value = t('auth.loginFailed')
    }
    finally {
      isLoading.value = false
    }
  }
}

onMounted(() => {
  // Safely initialize auth store with a delay
  setTimeout(async () => {
    try {
      const { useAuthStore } = await import('~/stores/auth')
      authStore.value = useAuthStore()
      isStoreReady.value = true

      // If user is already authenticated, redirect to dashboard
      if (authStore.value.isAuthenticated) {
        router.push('/dashboard')
      }
    }
    catch (error) {
      console.error('Error accessing auth store:', error)
    }
  }, 100)
})
</script>

<template>
  <div class="flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 h-full flex-grow-1">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2 class="text-4xl font-bold text-text-primary">
          {{ t('auth.signInTitle') }}
        </h2>
        <p class="mt-2 text-text-secondary">
          {{ t('auth.signInSubtitle') }}
        </p>
      </div>

      <!-- Form -->
      <div class="mt-8 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <!-- Error Message -->
        <div v-if="authError" class="rounded-lg bg-red-50 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="w-5 h-5 i-heroicons-x-circle text-red-400" />
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-800">
                {{ authError }}
              </p>
            </div>
          </div>
        </div>

        <!-- Institutional sign-in: the path a credential holder takes -->
        <div v-if="oauthProviders.length > 0" class="space-y-4">
          <button
            v-for="provider in oauthProviders"
            :key="provider"
            type="button"
            class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full shadow-sm text-base font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
            :style="{ backgroundColor: branding.primaryColor }"
            @click="startOAuth(provider)"
          >
            <div class="w-5 h-5 i-heroicons-academic-cap" />
            {{ t('auth.signInWithInstitution', { brand: branding.name }) }}
          </button>

          <button
            v-if="!showLocalForm"
            type="button"
            class="w-full text-center text-sm text-text-secondary hover:text-text-primary underline"
            @click="showLocalForm = true"
          >
            {{ t('auth.signInWithLocalAccount') }}
          </button>
        </div>

        <form v-show="oauthProviders.length === 0 || showLocalForm" class="space-y-6" :class="oauthProviders.length > 0 ? 'mt-6 pt-6 border-t border-gray-200' : ''" @submit.prevent="handleSubmit">
          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-text-primary">
              {{ t('auth.email') }}
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5AB69F] focus:border-transparent"
                :placeholder="t('auth.emailPlaceholder')"
              >
            </div>
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-text-primary">
              {{ t('auth.password') }}
            </label>
            <div class="mt-1">
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5AB69F] focus:border-transparent"
                :placeholder="t('auth.passwordPlaceholder')"
              >
            </div>
          </div>

          <!-- Remember & Forgot -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                class="h-4 w-4 text-[#00E5C5] focus:ring-[#5AB69F] border-gray-300 rounded"
              >
              <label for="remember-me" class="ml-2 block text-sm text-text-secondary">
                {{ t('auth.rememberMe') }}
              </label>
            </div>

            <div class="text-sm">
              <NuxtLink to="/forgot-password" class="font-medium text-text-secondary hover:text-[#5AB69F]/80">
                {{ t('auth.forgotPassword') }}
              </NuxtLink>
            </div>
          </div>

          <!-- Submit Button -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-white bg-[#5AB69F] hover:bg-[#5AB69F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5C5] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!isLoading" class="text-[#000]">{{ t('nav.login') }}</span>
              <div v-else class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </button>
          </div>
        </form>


      </div>
    </div>
  </div>
</template>
