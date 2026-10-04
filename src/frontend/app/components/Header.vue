<script setup lang="ts">
import { useWindowScroll } from '@vueuse/core'

const { t } = useI18n()
const branding = useBranding()
const router = useRouter()
const navLinks = computed(() => {
  if (!branding.active) return HEADER_NAV_LINKS
  const links = [{ name: 'Home', href: '/', i18nKey: 'home' }, { name: 'Verify', href: '/verify', i18nKey: 'verify' }]
  if (branding.catalogUrl) links.push({ name: 'Catalog', href: branding.catalogUrl, i18nKey: 'catalog' })
  if (isAuthenticated.value) {
    links.push({ name: 'Credentials', href: '/dashboard', i18nKey: 'myCredentials' }, { name: 'Prior learning', href: '/saberes-previos', i18nKey: 'priorLearning' })
    if (authStore.value?.isIssuer) links.push(...HEADER_NAV_LINKS.filter(link => ['/dashboard', '/issue'].includes(link.href)))
  }
  return links
})
const { enabled: portalTitularEnabled, request: portalRequest } = useSaberesPrevios()
const isStoreReady = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const showUserMenu = ref(false)
const logoutError = ref('')
const isAuthenticated = computed(() => !!authStore.value?.isAuthenticated)
const authStore = ref<ReturnType<typeof useAuthStore> | null>(null)
const userName = computed(() => authStore.value?.user?.username || authStore.value?.user?.email?.split('@')[0] || '')
const WINDOW_VERTICAL_SCROLL_THRESHOLD = 20
const { y } = useWindowScroll()

const hasWindowScrolled = computed(() => {
  return y.value > WINDOW_VERTICAL_SCROLL_THRESHOLD
})

const isMobileMenuOpen = shallowRef(false)
const mobileMenuRef = useTemplateRef('mobile-menu')
const mobileToggleRef = useTemplateRef('mobile-toggle')

onClickOutside(mobileMenuRef, () => isMobileMenuOpen.value = false, { ignore: [mobileToggleRef] })

async function handleLogout() {
  // Best effort, bounded by the portal request timeout. Never block global logout.
  logoutError.value = ''
  if (portalTitularEnabled) {
    try {
      await portalRequest('auth/salir', {})
    } catch {
      logoutError.value = 'Saliste de Certo, pero no pudimos confirmar el cierre de la sesión de saberes previos.'
    }
  }
  if (isStoreReady.value && authStore.value) {
    authStore.value.logout()
    router.push('/')
    showUserMenu.value = false
  }
}

onMounted(() => {
  // Safe initialization of auth store
  // Using setTimeout to ensure it runs after Pinia and plugins are initialized
  setTimeout(() => {
    try {
      // Try to dynamically import the store
      import('~/stores/auth')
        .then((module) => {
          const { useAuthStore } = module
          authStore.value = useAuthStore()
          isStoreReady.value = true
        })
        .catch((err) => {
          console.error('Error importing auth store:', err)
        })
    }
    catch (error) {
      console.error('Could not access auth store in layout:', error)
    }
  }, 100)
})

onUnmounted(() => {
  // Clear auth store reference
  authStore.value = null
  isStoreReady.value = false
})
</script>

<template>
  <nav
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    :class="{ 'bg-white/80 backdrop-blur-lg shadow-sm': hasWindowScrolled }"
  >
    <p v-if="logoutError" role="alert" class="bg-white p-3 text-red-800">{{ logoutError }}</p>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <span v-if="branding.active && branding.logoUrl === '/certo-logo-text.png'" class="text-2xl font-bold">{{ branding.name }}</span>
          <NuxtImg v-else
            :src="branding.logoUrl"
            :alt="`${branding.name} Logo`"
            class="h-10 w-auto"
          />
        </NuxtLink>

        <!-- Desktop Navigation -->
        <div class="hidden lg:flex items-center gap-6">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.name"
            :to="link.href"
            class="text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            {{ t(`nav.${link.i18nKey}`) || link.name }}
          </NuxtLink>

          <!-- Auth Buttons -->
          <div class="flex items-center gap-4 ml-6">
            <LanguageSwitcher />
            <template v-if="isAuthenticated && userName">
              <div class="relative">
                <button
                  ref="userMenuRef"
                  class="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors"
                  @click="showUserMenu = !showUserMenu"
                >
                  <span class="font-medium">{{ userName }}</span>
                  <div
                    class="w-5 h-5 i-heroicons-chevron-down"
                    :class="{ 'rotate-180': showUserMenu }"
                  />
                </button>

                <!-- User Menu Dropdown -->
                <div
                  v-if="showUserMenu"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50"
                >
                  <NuxtLink
                    to="/profile"
                    class="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="showUserMenu = false"
                  >
                    {{ t('nav.profile') }}
                  </NuxtLink>
                  <button
                    class="block w-full text-left px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="handleLogout"
                  >
                    {{ t('nav.logout') }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <NuxtLink
                to="/login"
                :class="branding.active ? 'brand-button px-4 py-2 rounded-full' : ''"
                class="font-medium text-text-primary hover:text-text-secondary transition-colors"
              >
                {{ t('nav.login') }}
              </NuxtLink>
              <NuxtLink
                v-if="!branding.active"
                to="/get-started"
                class="px-4 py-2 brand-button rounded-full font-medium transition-colors"
              >
                {{ t('nav.getStarted') }}
              </NuxtLink>
            </template>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <button
          ref="mobile-toggle"
          :aria-label="t('a11y.toggleMenu')"
          :aria-expanded="isMobileMenuOpen"
          aria-controls="mobile-menu"
          class="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <div v-if="!isMobileMenuOpen" class="w-6 h-6 i-heroicons-bars-3" />
          <div v-else class="w-6 h-6 i-heroicons-x-mark" />
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-if="isMobileMenuOpen" id="mobile-menu" ref="mobile-menu" class="lg:hidden bg-white border-t">
      <div class="px-4 py-2 space-y-1">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.name"
          :to="link.href"
          class="block py-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {{ t(`nav.${link.i18nKey}`) || link.name }}
        </NuxtLink>
        <div class="pt-4 space-y-2">
          <LanguageSwitcher v-if="branding.active" />
          <template v-if="isAuthenticated && userName">
            <NuxtLink
              to="/profile"
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.profile') }}
            </NuxtLink>
            <button
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
              @click="handleLogout"
            >
              {{ t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
                :class="branding.active ? 'brand-button px-4 py-2 rounded-full' : ''"
              class="block w-full py-2 text-center text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.login') }}
            </NuxtLink>
            <NuxtLink
              v-if="!branding.active"
                to="/get-started"
              class="block w-full py-2 text-center brand-button rounded-full transition-colors"
            >
              {{ t('nav.getStarted') }}
            </NuxtLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
