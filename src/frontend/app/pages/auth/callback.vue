<script setup lang="ts">
// Lands after the users-permissions OAuth/OIDC flow
// (/api/connect/:provider -> provider -> /api/connect/:provider/callback)
// completes and grant redirects here with ?access_token=<the *provider's*
// token>, per the callback URL configured in the admin panel. That token is
// not a Strapi session yet - the store exchanges it at
// /api/auth/:provider/callback. See docs/oauth-setup.md.
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const errorMessage = ref<string | null>(null)
const isProcessing = ref(true)

useHead({
  title: () => t('auth.callback.signingIn')
})

onMounted(() => {
  setTimeout(async () => {
    const accessToken = route.query.access_token as string | undefined
    const providerError = route.query.error as string | undefined

    if (providerError) {
      errorMessage.value = t('auth.callback.providerError', { error: providerError })
      isProcessing.value = false
      return
    }

    if (!accessToken) {
      errorMessage.value = t('auth.callback.noToken')
      isProcessing.value = false
      return
    }

    try {
      const { useAuthStore } = await import('~/stores/auth')
      const authStore = useAuthStore()
      // Which /api/auth/:provider/callback to exchange the token at. grant
      // appends its own params with '?' rather than '&', so a query string
      // baked into the configured callback URL arrives mangled - take the
      // provider from the app's own config instead.
      const configured = String(useRuntimeConfig().public.oauthProviders || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
      const provider = (route.query.provider as string | undefined)?.split('?')[0]
        || configured[0]
        || 'keycloak'
      const success = await authStore.loginWithOAuthToken(accessToken, provider)

      if (success) {
        router.push('/dashboard')
      }
      else {
        errorMessage.value = authStore.error || t('auth.callback.failed')
        isProcessing.value = false
      }
    }
    catch (error) {
      console.error('OAuth callback error:', error)
      errorMessage.value = t('auth.callback.failed')
      isProcessing.value = false
    }
  }, 100)
})
</script>

<template>
  <div class="flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 h-full flex-grow-1">
    <div class="max-w-md w-full space-y-8 text-center">
      <div v-if="errorMessage" class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <div class="rounded-lg bg-red-50 p-4 mb-6">
          <p class="text-sm text-red-800">
            {{ errorMessage }}
          </p>
        </div>
        <NuxtLink to="/login" class="text-[#5AB69F] underline">
          {{ t('auth.callback.backToLogin') }}
        </NuxtLink>
      </div>
      <div v-else-if="isProcessing">
        <p class="text-text-secondary">
          {{ t('auth.callback.signingIn') }}
        </p>
      </div>
    </div>
  </div>
</template>
