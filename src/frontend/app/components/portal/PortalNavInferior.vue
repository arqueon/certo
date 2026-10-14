<script setup lang="ts">
// Navegación inferior del titular en celular: Credenciales · Mis carteras · Perfil.
const { t } = useI18n()
const route = useRoute()
const tabs = computed(() => [
  { href: '/dashboard', label: t('portal.b.nav.credentials'), icon: 'i-heroicons-academic-cap' },
  { href: '/carteras', label: t('portal.b.nav.wallets'), icon: 'i-heroicons-wallet' },
  { href: '/profile', label: t('nav.profile'), icon: 'i-heroicons-user-circle' },
])
const { pendientes } = useCarteraPendiente()
const active = (href: string) => route.path === href || route.path.startsWith(`${href}/`) || (href === '/dashboard' && route.path.startsWith('/credentials/'))
</script>

<template>
  <nav class="mc-nav-inferior" :aria-label="t('portal.b.nav.holder')">
    <NuxtLink v-for="tab in tabs" :key="tab.href" :to="tab.href" :aria-current="active(tab.href) ? 'page' : undefined">
      <span class="mc-nav-inferior__icono" aria-hidden="true">
        <span :class="tab.icon" />
        <span v-if="tab.href === '/carteras' && pendientes.length" class="mc-insignia-aviso" data-testid="insignia-carteras" />
      </span>
      {{ tab.label }}
      <span v-if="tab.href === '/carteras' && pendientes.length" class="sr-only">{{ t('portal.b.walletNotice.badge') }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.mc-nav-inferior {
  position: fixed; z-index: 40; left: .75rem; right: .75rem; bottom: calc(.75rem + env(safe-area-inset-bottom));
  display: flex; padding: 6px; border-radius: 18px; background: #1a203b; box-shadow: 0 12px 30px -10px rgba(10, 14, 30, .55);
}
.mc-nav-inferior a {
  flex: 1; display: grid; justify-items: center; gap: 2px; padding: .45rem 0; border-radius: 13px;
  color: #c3cfe2; font-size: var(--mc-t-xs); font-weight: 600; text-decoration: none;
}
.mc-nav-inferior__icono { position: relative; font-size: 1.3rem; line-height: 1; }
.mc-insignia-aviso { position: absolute; top: -3px; right: -7px; width: 11px; height: 11px; border-radius: 50%; background: #f2bb63; box-shadow: 0 0 0 2px #1a203b; }
.mc-nav-inferior a[aria-current='page'] { background: #fff; color: #1a203b; font-weight: 800; }
@media (min-width: 1024px) { .mc-nav-inferior { display: none; } }
</style>
