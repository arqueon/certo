<script setup lang="ts">
import { useMounted } from '@vueuse/core'

const { t } = useI18n()
const branding = useBranding()
const authStore = useAuthStore()
// Con marca y sesión, el titular navega en celular con la barra inferior.
const mounted = useMounted()
const bottomNav = computed(() => mounted.value && branding.active && authStore.isAuthenticated)
// Una cartera nueva que espera confirmación se avisa en todas las páginas.
useVigilanciaCarteras(bottomNav)
</script>

<template>
  <div class="min-h-screen flex flex-col" :class="branding.active ? 'mc-marco' : 'bg-gradient-to-b from-white to-[#FFE5AE]/20'">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-text-primary focus:shadow-lg"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <!-- Navigation -->
    <PortalEncabezado v-if="branding.active" />
    <Header v-else />

    <!-- Main Content -->
    <main id="main-content" class="pt-16 flex-grow flex flex-col" :class="branding.active ? 'mc-principal' : 'mb-32'" tabindex="-1">
      <PortalAvisoCartera v-if="bottomNav" />
      <slot />
    </main>

    <!-- Footer -->
    <Footer :class="{ 'mc-con-nav': bottomNav }" />
    <PortalNavInferior v-if="bottomNav" />
  </div>
</template>

<style>
:root {
  --text-primary: #2D3436;
  --text-secondary: #636E72;
}

body {
  font-family: 'Space Grotesk', sans-serif;
  color: var(--text-primary);
}

.mc-marco { background: var(--mc-fondo); color: var(--mc-texto); }
.mc-principal { margin-bottom: 4rem; }
@media (max-width: 1023px) { .mc-con-nav { padding-bottom: 6.5rem !important; } }

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
