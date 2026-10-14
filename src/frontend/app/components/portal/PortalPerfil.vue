<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { apiClient } from '~/api/api-client'
import { downloadJson } from '~/utils/download'
import { safeHttpUrl } from '~/utils/portal'

// Perfil del titular en la dirección B: datos de la cuenta institucional (solo
// lectura), qué se ve de la persona al compartir una credencial, descarga de
// sus datos, carteras vinculadas, idioma y cierre de sesión.
const { t, locale, locales, setLocale } = useI18n()
const branding = useBranding()
const authStore = useAuthStore()
const router = useRouter()
const config = useRuntimeConfig()
const accountUrl = safeHttpUrl((config.public as Record<string, unknown>).accountUrl)
const { enabled: portalTitularEnabled, request: portalRequest } = useSaberesPrevios()

// La sesión vive en localStorage: todo lo que depende de ella espera al montaje.
const mounted = useMounted()
const name = computed(() => !mounted.value ? '' : authStore.profile?.name || authStore.user?.username || '')
const email = computed(() => !mounted.value ? '' : authStore.profile?.email || authStore.user?.email || '')
const username = computed(() => !mounted.value ? '' : authStore.user?.username || '')
const initial = computed(() => name.value.trim().charAt(0).toUpperCase() || '·')
const since = computed(() => {
  const value = mounted.value ? authStore.user?.createdAt : ''
  return value ? new Date(value).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
})

const wallets = ref<number | null>(null)
const walletsError = ref(false)
onMounted(async () => {
  try {
    wallets.value = ((await apiClient.get<{ data: unknown[] }>('/api/holder/wallets')).data || []).length
  }
  catch { walletsError.value = true }
})
const walletsText = computed(() => wallets.value === 0
  ? t('portal.b.profile.walletsNone')
  : wallets.value === 1 ? t('portal.b.profile.walletsOne') : t('portal.b.profile.walletsSome', { n: wallets.value ?? 0 }))

const exporting = ref(false)
const exportError = ref(false)
async function exportData() {
  exporting.value = true
  exportError.value = false
  try {
    const data = await apiClient.get<unknown>('/api/profiles/me/export')
    downloadJson(data, `mis-datos-${branding.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`)
  }
  catch { exportError.value = true }
  finally { exporting.value = false }
}

// Español e inglés primero (los del portal UDGPlus); el resto, en su orden.
const PRIMEROS = ['es', 'en']
const languages = computed(() => [...(locales.value as Array<{ code: string, name: string }>)]
  .sort((a, b) => (PRIMEROS.includes(a.code) ? PRIMEROS.indexOf(a.code) : 9) - (PRIMEROS.includes(b.code) ? PRIMEROS.indexOf(b.code) : 9)))

const logoutError = ref('')
async function logout() {
  // Como en el encabezado: cerrar la sesión de saberes previos no debe impedir salir.
  logoutError.value = ''
  if (portalTitularEnabled) {
    try {
      await portalRequest('auth/salir', {})
    }
    catch { logoutError.value = t('portal.b.nav.logoutPartial') }
  }
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="mc-perfil">
    <section class="mc-perfil__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor mc-perfil__identidad">
        <span class="mc-perfil__avatar" aria-hidden="true">{{ initial }}</span>
        <div>
          <p class="mc-etiqueta">
            {{ t('portal.b.profile.eyebrow') }}
          </p>
          <h1 class="mc-titulo" data-testid="perfil-nombre">
            {{ name || t('portal.b.profile.title') }}
          </h1>
          <p v-if="email" class="mc-perfil__correo">
            {{ email }}
          </p>
          <span class="mc-chip mc-chip--vidrio">{{ t('portal.b.profile.institutional') }}</span>
        </div>
      </div>
    </section>

    <div class="mc-contenedor mc-perfil__cuerpo">
      <div class="mc-perfil__principal">
        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-datos">
          <h2 id="perfil-datos" class="mc-titulo">
            {{ t('portal.b.profile.dataTitle') }}
          </h2>
          <dl class="mc-perfil__datos">
            <div>
              <dt>{{ t('portal.b.profile.name') }}</dt>
              <dd>{{ name || '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('portal.b.profile.email') }}</dt>
              <dd>{{ email || '—' }}</dd>
            </div>
            <div v-if="username && username !== email">
              <dt>{{ t('portal.b.profile.user') }}</dt>
              <dd>{{ username }}</dd>
            </div>
            <div v-if="since">
              <dt>{{ t('portal.b.profile.since') }}</dt>
              <dd>{{ since }}</dd>
            </div>
          </dl>
          <div class="mc-aviso">
            <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-information-circle" /></span>
            <div class="mc-perfil__nota">
              <p>{{ accountUrl ? t('portal.b.profile.dataNote') : t('portal.b.profile.dataNoteNoUrl') }}</p>
              <p class="mc-suave">
                {{ t('portal.b.profile.nameNote') }}
              </p>
              <a v-if="accountUrl" :href="accountUrl" class="mc-boton mc-boton--secundario" target="_blank" rel="noopener">
                {{ t('portal.b.profile.accountLink') }} <span class="i-heroicons-arrow-top-right-on-square" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-privacidad" data-testid="perfil-privacidad">
          <h2 id="perfil-privacidad" class="mc-titulo">
            {{ t('portal.b.profile.privacyTitle') }}
          </h2>
          <p>{{ t('portal.b.profile.privacyIntro') }}</p>
          <ul class="mc-perfil__lista">
            <li><span class="i-heroicons-eye" aria-hidden="true" />{{ t('portal.b.profile.privacyShown1') }}</li>
            <li><span class="i-heroicons-eye" aria-hidden="true" />{{ t('portal.b.profile.privacyShown2') }}</li>
            <li><span class="i-heroicons-eye" aria-hidden="true" />{{ t('portal.b.profile.privacyShown3') }}</li>
            <li class="mc-perfil__oculto">
              <span class="i-heroicons-eye-slash" aria-hidden="true" />{{ t('portal.b.profile.privacyHidden') }}
            </li>
          </ul>
          <p class="mc-suave">
            {{ t('portal.b.profile.privacyControl') }}
          </p>
          <NuxtLink to="/dashboard" class="mc-boton mc-boton--secundario">
            {{ t('portal.b.profile.privacyGo') }}
          </NuxtLink>
        </section>

        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-exportar">
          <h2 id="perfil-exportar" class="mc-titulo">
            {{ t('portal.b.profile.exportTitle') }}
          </h2>
          <p class="mc-suave">
            {{ t('portal.b.profile.exportText') }}
          </p>
          <div>
            <button type="button" class="mc-boton" :disabled="exporting" data-testid="perfil-exportar" @click="exportData">
              <span class="i-heroicons-arrow-down-tray" aria-hidden="true" />
              {{ exporting ? t('portal.b.profile.exporting') : t('portal.b.profile.exportButton') }}
            </button>
          </div>
          <p v-if="exportError" class="mc-perfil__error" role="alert">
            {{ t('portal.b.profile.exportError') }}
          </p>
        </section>
      </div>

      <aside class="mc-perfil__lateral">
        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-carteras">
          <h2 id="perfil-carteras" class="mc-titulo">
            <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-wallet" /></span>
            {{ t('portal.b.profile.walletsTitle') }}
          </h2>
          <p v-if="walletsError" class="mc-suave">
            {{ t('portal.b.profile.walletsError') }}
          </p>
          <p v-else-if="wallets !== null" data-testid="perfil-carteras">
            {{ walletsText }}
          </p>
          <NuxtLink to="/carteras" class="mc-boton mc-boton--secundario">
            {{ t('portal.b.profile.walletsGo') }}
          </NuxtLink>
        </section>

        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-idioma">
          <h2 id="perfil-idioma" class="mc-titulo">
            <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-language" /></span>
            {{ t('portal.b.profile.languageTitle') }}
          </h2>
          <p class="mc-suave">
            {{ t('portal.b.profile.languageHelp') }}
          </p>
          <div class="mc-perfil__idiomas" role="radiogroup" :aria-label="t('portal.b.profile.languageTitle')">
            <button
              v-for="l in languages"
              :key="l.code"
              type="button"
              role="radio"
              :aria-checked="l.code === locale"
              class="mc-perfil__idioma"
              :class="{ 'mc-perfil__idioma--activo': l.code === locale }"
              @click="setLocale(l.code)"
            >
              {{ l.name }}
            </button>
          </div>
        </section>

        <section class="mc-tarjeta mc-perfil__bloque" aria-labelledby="perfil-sesion">
          <h2 id="perfil-sesion" class="mc-titulo">
            <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-arrow-right-on-rectangle" /></span>
            {{ t('portal.b.profile.sessionTitle') }}
          </h2>
          <p class="mc-suave">
            {{ t('portal.b.profile.sessionText') }}
          </p>
          <button type="button" class="mc-boton mc-boton--secundario" data-testid="perfil-salir" @click="logout">
            {{ t('nav.logout') }}
          </button>
          <p v-if="logoutError" class="mc-perfil__error" role="alert">
            {{ logoutError }}
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.mc-perfil__cabeza { padding: 1.75rem 0 5rem; }
.mc-perfil__identidad { display: flex; gap: 1.1rem; align-items: center; }
.mc-perfil__identidad > div { display: grid; gap: .3rem; justify-items: start; min-width: 0; }
.mc-perfil__identidad .mc-etiqueta { opacity: .85; }
.mc-perfil__identidad h1 { font-size: var(--mc-t-2xl); overflow-wrap: anywhere; }
.mc-perfil__correo { opacity: .9; overflow-wrap: anywhere; }
.mc-perfil__avatar {
  flex: none; display: grid; place-items: center; width: 4.25rem; height: 4.25rem; border-radius: 22px;
  background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .35);
  font: 800 1.9rem var(--mc-fuente-titulos); color: #fff;
}
.mc-perfil__cuerpo { margin-top: -3.25rem; display: grid; gap: 1.25rem; align-items: start; }
.mc-perfil__principal, .mc-perfil__lateral { display: grid; gap: 1.25rem; min-width: 0; }
.mc-perfil__bloque { padding: 1.35rem; display: grid; gap: .85rem; justify-items: start; }
.mc-perfil__bloque > * { max-width: 100%; }
.mc-perfil__bloque h2 { font-size: var(--mc-t-l); display: flex; align-items: center; gap: .6rem; }
.mc-perfil__bloque h2 .mc-mosaico { width: 2.25rem; height: 2.25rem; border-radius: 10px; font-size: 1.15rem; }
.mc-perfil__datos { display: grid; gap: .85rem; width: 100%; }
.mc-perfil__datos dt { font-size: var(--mc-t-xs); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--mc-suave); }
.mc-perfil__datos dd { font-weight: 600; overflow-wrap: anywhere; }
.mc-perfil__nota { display: grid; gap: .6rem; justify-items: start; }
.mc-perfil .mc-aviso { width: 100%; }
.mc-perfil__lista { display: grid; gap: .55rem; }
.mc-perfil__lista li { display: flex; gap: .6rem; align-items: flex-start; line-height: 1.5; }
.mc-perfil__lista li > span { flex: none; margin-top: .2rem; color: var(--mc-enlace); }
.mc-perfil__oculto { padding-top: .55rem; border-top: 1px solid var(--mc-linea); }
.mc-perfil__oculto > span { color: var(--mc-ok) !important; }
.mc-perfil__error { color: var(--mc-no); font-weight: 600; font-size: var(--mc-t-s); }
.mc-perfil__idiomas { display: flex; flex-wrap: wrap; gap: .5rem; }
.mc-perfil__idioma {
  min-height: 44px; padding: .5rem 1rem; border-radius: 999px; border: 1px solid var(--mc-linea);
  background: var(--mc-superficie); color: var(--mc-texto); font-weight: 600; cursor: pointer;
}
.mc-perfil__idioma--activo { background: var(--mc-primario); border-color: var(--mc-primario); color: var(--mc-primario-texto); }
@media (min-width: 768px) {
  .mc-perfil__cabeza { padding: 2.5rem 0 5.5rem; }
  .mc-perfil__identidad h1 { font-size: var(--mc-t-3xl); }
  .mc-perfil__avatar { width: 5.25rem; height: 5.25rem; font-size: 2.3rem; }
  .mc-perfil__cuerpo { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
  .mc-perfil__datos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
