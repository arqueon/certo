<script setup lang="ts">
import { onClickOutside, useMounted } from '@vueuse/core'

// Encabezado de la dirección B: barra azul marino con el logotipo en blanco.
// En celular, con sesión, Credenciales · Mis carteras · Perfil viven en la
// navegación inferior; el menú queda para lo demás.
const { t } = useI18n()
const branding = useBranding()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { enabled: portalTitularEnabled, request: portalRequest } = useSaberesPrevios()
// La sesión vive en localStorage: el servidor siempre pinta sin sesión, así
// que se lee al montar para no desajustar la hidratación.
const mounted = useMounted()
const isAuthenticated = computed(() => mounted.value && authStore.isAuthenticated)
const userName = computed(() => authStore.profile?.name || authStore.user?.username || authStore.user?.email?.split('@')[0] || '')
const initial = computed(() => userName.value.trim().charAt(0).toUpperCase() || '·')

const links = computed(() => {
  const list: { href: string, label: string, external?: boolean }[] = []
  if (isAuthenticated.value) {
    list.push({ href: '/dashboard', label: t('nav.myCredentials') }, { href: '/carteras', label: t('portal.b.nav.wallets') })
    list.push({ href: '/saberes-previos', label: t('nav.priorLearning') })
    if (authStore.isIssuer) { list.push({ href: '/issue', label: t('nav.issue') }) }
  }
  else {
    list.push({ href: '/', label: t('nav.home') })
  }
  list.push({ href: '/verify', label: t('nav.verify') })
  if (branding.catalogUrl) { list.push({ href: branding.catalogUrl, label: t('nav.catalog'), external: true }) }
  return list
})
const { pendientes } = useCarteraPendiente()
const conAviso = (href: string) => href === '/carteras' && pendientes.value.length > 0
const active = (href: string) => route.path === href || (href !== '/' && route.path.startsWith(`${href}/`))

const menuOpen = ref(false)
const userOpen = ref(false)
const menuRef = useTemplateRef('menu')
const toggleRef = useTemplateRef('toggle')
const userRef = useTemplateRef('user')
onClickOutside(menuRef, () => { menuOpen.value = false }, { ignore: [toggleRef] })
onClickOutside(userRef, () => { userOpen.value = false })
watch(() => route.fullPath, () => { menuOpen.value = false; userOpen.value = false })

const logoutError = ref('')
async function logout() {
  // Igual que el encabezado original: cerrar la sesión del portal no debe
  // impedir salir de Certo.
  logoutError.value = ''
  if (portalTitularEnabled) {
    try { await portalRequest('auth/salir', {}) }
    catch { logoutError.value = t('portal.b.nav.logoutPartial') }
  }
  authStore.logout()
  userOpen.value = false
  router.push('/')
}
</script>

<template>
  <header class="mc-encabezado mc-degradado">
    <p v-if="logoutError" role="alert" class="mc-encabezado__error">
      {{ logoutError }}
    </p>
    <div class="mc-contenedor mc-encabezado__barra">
      <NuxtLink :to="isAuthenticated ? '/dashboard' : '/'" class="mc-encabezado__logo">
        <img :src="branding.logoUrl" :alt="branding.name" height="28">
      </NuxtLink>

      <nav class="mc-encabezado__nav" :aria-label="t('portal.b.nav.main')">
        <template v-for="link in links" :key="link.href">
          <a v-if="link.external" :href="link.href">{{ link.label }}</a>
          <NuxtLink v-else :to="link.href" :aria-current="active(link.href) ? 'page' : undefined">
            {{ link.label }}<span v-if="conAviso(link.href)" class="mc-encabezado__insignia" data-testid="insignia-carteras-escritorio"><span class="sr-only">{{ t('portal.b.walletNotice.badge') }}</span></span>
          </NuxtLink>
        </template>
      </nav>

      <div class="mc-encabezado__acciones">
        <LanguageSwitcher class="mc-encabezado__idioma" />
        <div v-if="isAuthenticated" ref="user" class="mc-encabezado__usuario">
          <button class="mc-avatar" :aria-expanded="userOpen" :aria-label="t('portal.b.nav.account', { name: userName })" @click="userOpen = !userOpen">
            {{ initial }}
          </button>
          <div v-if="userOpen" class="mc-menu mc-tarjeta">
            <p class="mc-menu__nombre">
              {{ userName }}
            </p>
            <NuxtLink to="/profile">
              {{ t('nav.profile') }}
            </NuxtLink>
            <button @click="logout">
              {{ t('nav.logout') }}
            </button>
          </div>
        </div>
        <NuxtLink v-else to="/login" class="mc-boton mc-boton--claro">
          {{ t('nav.login') }}
        </NuxtLink>
        <button
          ref="toggle" class="mc-encabezado__menu-boton" :aria-expanded="menuOpen" aria-controls="mc-menu-movil"
          :aria-label="t('a11y.toggleMenu')" @click="menuOpen = !menuOpen"
        >
          <span :class="menuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'" aria-hidden="true" />
        </button>
      </div>
    </div>
    <nav v-if="menuOpen" id="mc-menu-movil" ref="menu" class="mc-menu-movil" :aria-label="t('portal.b.nav.main')">
      <template v-for="link in links" :key="link.href">
        <a v-if="link.external" :href="link.href">{{ link.label }}</a>
        <NuxtLink v-else :to="link.href" :aria-current="active(link.href) ? 'page' : undefined">
          {{ link.label }}<span v-if="conAviso(link.href)" class="mc-encabezado__insignia"><span class="sr-only">{{ t('portal.b.walletNotice.badge') }}</span></span>
        </NuxtLink>
      </template>
      <button v-if="isAuthenticated" @click="logout">
        {{ t('nav.logout') }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.mc-encabezado { position: fixed; inset: 0 0 auto; z-index: 50; background: var(--mc-navy); }
.mc-encabezado__error { background: var(--mc-no-fondo); color: var(--mc-no); padding: .5rem 1rem; }
.mc-encabezado__barra { display: flex; align-items: center; gap: 1.5rem; height: 64px; }
.mc-encabezado__logo img { height: 28px; width: auto; filter: brightness(0) invert(1); }
.mc-encabezado__nav { display: none; gap: .25rem; margin-inline-start: auto; }
.mc-encabezado__nav a { color: rgba(255, 255, 255, .82); font-weight: 600; font-size: var(--mc-t-s); padding: .5rem .75rem; border-radius: 10px; text-decoration: none; }
.mc-encabezado__nav a:hover { color: #fff; background: rgba(255, 255, 255, .1); }
.mc-encabezado__nav a[aria-current='page'] { color: #fff; background: rgba(255, 255, 255, .16); }
.mc-encabezado__insignia { display: inline-block; width: 9px; height: 9px; margin-inline-start: .35rem; vertical-align: super; border-radius: 50%; background: #f2bb63; }
.mc-encabezado__acciones { display: flex; align-items: center; gap: .5rem; margin-inline-start: auto; }
.mc-encabezado__idioma :deep(button) { color: rgba(255, 255, 255, .85); }
.mc-encabezado__idioma :deep(button:hover) { background: rgba(255, 255, 255, .1); }
.mc-encabezado__usuario { position: relative; }
.mc-avatar { width: 36px; height: 36px; border-radius: 50%; background: #fff; color: var(--mc-navy, #1a203b); font: 800 1rem var(--mc-fuente-titulos); display: grid; place-items: center; }
.mc-menu { position: absolute; right: 0; top: calc(100% + .5rem); min-width: 13rem; padding: .4rem; display: grid; color: var(--mc-texto); }
.mc-menu__nombre { padding: .5rem .75rem; font-weight: 700; border-bottom: 1px solid var(--mc-linea); margin-bottom: .25rem; overflow-wrap: anywhere; }
.mc-menu a, .mc-menu button { text-align: left; padding: .6rem .75rem; border-radius: 10px; color: var(--mc-texto); text-decoration: none; }
.mc-menu a:hover, .mc-menu button:hover { background: var(--mc-hielo); }
.mc-encabezado__menu-boton { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; color: #fff; font-size: 1.5rem; }
.mc-encabezado__menu-boton:hover { background: rgba(255, 255, 255, .1); }
.mc-menu-movil { display: grid; padding: .5rem 1rem 1rem; border-top: 1px solid rgba(255, 255, 255, .15); }
.mc-menu-movil a, .mc-menu-movil button { color: #fff; text-align: left; padding: .75rem .25rem; font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(255, 255, 255, .08); }
.mc-menu-movil a[aria-current='page'] { text-decoration: underline; text-underline-offset: 5px; }
@media (min-width: 1024px) {
  .mc-encabezado__nav { display: flex; }
  .mc-encabezado__acciones { margin-inline-start: 0; }
  .mc-encabezado__menu-boton, .mc-menu-movil { display: none; }
}
</style>
