<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { apiClient } from '~/api/api-client'
import { skillsOf } from '~/utils/credential-metadata'
import { downloadJson } from '~/utils/download'

// Portada del titular en la dirección B «Insignia viva»: saludo, la credencial
// más reciente como tarjeta destacada con su acción principal, y el resto en
// una lista compacta. El detalle, las descargas y la privacidad viven en la
// página de cada credencial.
const props = defineProps<{ credentials: any[], loading: boolean, error: string | null }>()
const { t, locale } = useI18n()
const branding = useBranding()
const authStore = useAuthStore()

// Datos de la sesión: solo en el cliente (ver PortalEncabezado).
const mounted = useMounted()
const busy = computed(() => props.loading || !mounted.value)
const firstName = computed(() => !mounted.value ? '' : (authStore.profile?.name || '').trim().split(/\s+/)[0] || '')
const DAY = 86_400_000
function date(value?: string) {
  return value
    ? new Date(value).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
}
const idOf = (c: any) => String(c.credentialId || c.id)
const issued = (c: any) => c.issuanceDate || c.validFrom || c.issueDate
const expiry = (c: any) => c.expirationDate || c.validUntil
function kind(c: any) {
  const type = c.achievement?.achievementType
  if (!type) { return t('portal.b.kinds.default') }
  const label = t(`portal.b.kinds.${type}`)
  return label === `portal.b.kinds.${type}` ? type : label
}
type Estado = 'vigente' | 'vencida' | 'revocada'
function estado(c: any): Estado {
  if (c.revoked) { return 'revocada' }
  const until = expiry(c)
  return until && Date.parse(until) < Date.now() ? 'vencida' : 'vigente'
}
const chip: Record<Estado, string> = { vigente: 'mc-chip--ok', vencida: 'mc-chip--esp', revocada: 'mc-chip--no' }
function estadoTexto(c: any) {
  const e = estado(c)
  if (e !== 'vigente') { return t(`portal.b.status.${e}`) }
  return expiry(c) ? t('portal.b.status.vigenteHasta', { date: date(expiry(c)) }) : t('portal.b.status.vigenteSiempre')
}

const ordered = computed(() => [...props.credentials].sort((a, b) => (Date.parse(issued(b)) || 0) - (Date.parse(issued(a)) || 0)))
// Destacada: la más reciente que siga vigente; si ninguna lo está, la más reciente.
const featured = computed(() => ordered.value.find(c => estado(c) === 'vigente') || ordered.value[0] || null)
const rest = computed(() => ordered.value.filter(c => c !== featured.value))
// Para LinkedIn y «Para seguir aprendiendo»: la clave de la ficha (humanCode) y
// las habilidades viajan en los metadatos 0023 del logro de la credencial.
const websiteUrl = useRuntimeConfig().public.websiteUrl || WEBSITE_URL
const metadata = (c: any) => c?.achievementMetadata0023 || c?.achievement?.metadata0023 || {}
const fichaClave = (c: any) => metadata(c).humanCode || ''
const skillNames = (c: any) => skillsOf(metadata(c).alignment || []).map(s => s.name)
const linkedinOf = (c: any) => ({
  name: c.name || c.achievement?.name || '',
  organization: c.issuer?.name || branding.name,
  issued: issued(c),
  expires: expiry(c),
  certId: idOf(c),
  url: `${websiteUrl}/credentials/${encodeURIComponent(idOf(c))}`,
})
const vigentes = computed(() => props.credentials.filter(c => estado(c) === 'vigente').length)
const isNew = (c: any) => Date.now() - (Date.parse(issued(c)) || 0) < 30 * DAY

const summary = computed(() => {
  if (props.loading) { return t('portal.b.home.loading') }
  if (!props.credentials.length) { return t('portal.b.home.summaryNone') }
  return vigentes.value === 1 ? t('portal.b.home.summaryOne') : t('portal.b.home.summary', { count: vigentes.value })
})

const historyBusy = ref(false)
const historyMessage = ref('')
async function exportHistory() {
  historyBusy.value = true; historyMessage.value = ''
  try {
    const response = await apiClient.get<{ data: any[] }>('/api/holder/clrs')
    if (!response.data.length) { historyMessage.value = t('portal.holder.noClr'); return }
    response.data.forEach((record, index) => downloadJson(record, `history-${index + 1}.json`))
  }
  catch { historyMessage.value = t('portal.holder.error') }
  finally { historyBusy.value = false }
}
</script>

<template>
  <div class="mc-inicio">
    <section class="mc-inicio__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor">
        <h1 class="mc-titulo">
          {{ firstName ? t('portal.b.home.hello', { name: firstName }) : t('portal.b.home.helloAnon') }}
        </h1>
        <p>{{ summary }}</p>
      </div>
    </section>

    <div class="mc-contenedor mc-inicio__cuerpo">
      <div v-if="busy" class="mc-pase mc-pase--esqueleto" role="status" :aria-label="t('portal.b.home.loading')" />

      <div v-else-if="error" class="mc-aviso mc-aviso--no" role="alert">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-exclamation-triangle" /></span>
        <div>
          <p>{{ error }}</p>
          <button class="mc-boton mc-boton--texto" @click="$router.go(0)">
            {{ t('common.tryAgain') }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="mc-inicio__rejilla">
          <div class="mc-inicio__principal">
            <article v-if="featured" class="mc-pase mc-degradado" data-testid="credencial-destacada">
              <div class="mc-pase__emblema" aria-hidden="true">
                <span>+</span>
              </div>
              <p class="mc-etiqueta mc-pase__etiqueta">
                <template v-if="isNew(featured)">
                  {{ t('portal.b.home.new') }} ·
                </template>{{ kind(featured) }}
              </p>
              <h2 class="mc-titulo mc-pase__nombre">
                {{ featured.name || featured.achievement?.name }}
              </h2>
              <span class="mc-chip" :class="estado(featured) === 'vigente' ? 'mc-chip--vidrio' : chip[estado(featured)]">{{ estadoTexto(featured) }}</span>
              <dl class="mc-pase__datos">
                <div><dt>{{ t('portal.b.home.issued') }}</dt><dd>{{ date(issued(featured)) }}</dd></div>
                <div><dt>{{ t('portal.b.home.issuer') }}</dt><dd>{{ featured.issuer?.name || branding.name }}</dd></div>
              </dl>
              <HolderWallet :credential-id="idOf(featured)" compacto>
                <NuxtLink :to="`/credentials/${encodeURIComponent(idOf(featured))}`" class="mc-boton mc-boton--vidrio">
                  {{ t('portal.b.home.details') }}
                </NuxtLink>
              </HolderWallet>
              <PortalLinkedin v-if="estado(featured) === 'vigente'" :credential="linkedinOf(featured)" :skills="skillNames(featured)" claro class="mc-pase__linkedin" />
            </article>

            <section v-else class="mc-vacio mc-tarjeta" data-testid="sin-credenciales">
              <span class="mc-mosaico mc-vacio__icono" aria-hidden="true"><span class="i-heroicons-academic-cap" /></span>
              <h2 class="mc-titulo">
                {{ t('portal.b.home.emptyTitle') }}
              </h2>
              <p class="mc-suave">
                {{ t('portal.b.home.emptyText') }}
              </p>
              <a v-if="branding.catalogUrl" :href="branding.catalogUrl" class="mc-boton">{{ t('portal.b.home.emptyCatalog') }}</a>
            </section>
            <section v-if="rest.length" class="mc-lista" aria-labelledby="mc-todas">
              <h2 id="mc-todas" class="mc-titulo">
                {{ t('portal.b.home.all') }}
              </h2>
              <ul>
                <li v-for="c in rest" :key="idOf(c)">
                  <NuxtLink :to="`/credentials/${encodeURIComponent(idOf(c))}`" class="mc-mini mc-tarjeta">
                    <span class="mc-mini__icono" :class="`mc-mini__icono--${estado(c)}`" aria-hidden="true">{{ estado(c) === 'vigente' ? '+' : estado(c) === 'vencida' ? '◔' : '×' }}</span>
                    <span class="mc-mini__texto">
                      <b>{{ c.name || c.achievement?.name }}</b>
                      <small>{{ estadoTexto(c) }} · {{ t('portal.b.home.issuedOn', { date: date(issued(c)) }) }}</small>
                    </span>
                    <span class="mc-mini__flecha i-heroicons-chevron-right" aria-hidden="true" />
                  </NuxtLink>
                </li>
              </ul>
            </section>
            <PortalRutaAvance :credentials="credentials" />
            <PortalSiguientes v-if="featured" :clave="fichaClave(featured)" :nombre="featured.name || featured.achievement?.name" />
          </div>

          <aside class="mc-accesos" :aria-label="t('portal.b.home.shortcuts')">
            <NuxtLink to="/carteras" class="mc-acceso mc-tarjeta">
              <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-wallet" /></span>
              <span><b>{{ t('portal.b.nav.wallets') }}</b><small>{{ t('portal.b.home.walletsHint') }}</small></span>
              <span class="mc-acceso__flecha i-heroicons-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/saberes-previos" class="mc-acceso mc-tarjeta">
              <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-light-bulb" /></span>
              <span><b>{{ t('nav.priorLearning') }}</b><small>{{ t('portal.b.home.priorHint') }}</small></span>
              <span class="mc-acceso__flecha i-heroicons-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <button class="mc-acceso mc-tarjeta" :disabled="historyBusy" @click="exportHistory">
              <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-arrow-down-tray" /></span>
              <span><b>{{ t('portal.b.home.history') }}</b><small>{{ historyMessage || t('portal.b.home.historyHint') }}</small></span>
            </button>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mc-inicio__cabeza { padding: 1.75rem 0 5.5rem; }
.mc-inicio__cabeza h1 { font-size: var(--mc-t-2xl); }
.mc-inicio__cabeza p { margin-top: .35rem; opacity: .88; font-size: var(--mc-t-l); }
.mc-inicio__cuerpo { margin-top: -4rem; display: grid; gap: 2rem; }
.mc-inicio__rejilla { display: grid; gap: 2rem; }
.mc-inicio__principal { display: grid; gap: 2rem; align-content: start; min-width: 0; }

.mc-pase {
  position: relative; overflow: hidden; border-radius: var(--mc-r-l); padding: 1.25rem;
  box-shadow: var(--mc-sombra-alta); display: grid; gap: .75rem; align-content: start;
}
.mc-pase::after {
  content: ''; position: absolute; right: -60px; bottom: -90px; width: 220px; height: 220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 171, 208, .35), transparent 70%); pointer-events: none;
}
.mc-pase > * { position: relative; z-index: 1; }
.mc-pase--esqueleto { min-height: 260px; background: var(--mc-superficie); animation: mc-latido 1.4s ease-in-out infinite; }
@keyframes mc-latido { 50% { opacity: .55; } }
.mc-pase__emblema { position: absolute; top: 1.25rem; right: 1.25rem; width: 54px; height: 54px; border-radius: 16px; background: #fff; display: grid; place-items: center; }
.mc-pase__emblema span { font: 800 28px var(--mc-fuente-titulos); background: var(--mc-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.mc-pase__etiqueta { opacity: .85; padding-right: 4.5rem; }
.mc-pase__nombre { font-size: var(--mc-t-xl); font-weight: 700; line-height: 1.15; padding-right: 4.5rem; }
.mc-pase .mc-chip { justify-self: start; }
.mc-pase__linkedin { border-top: 1px solid rgba(255, 255, 255, .25); padding-top: .85rem; margin-top: .15rem; }
.mc-pase__datos { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; font-size: var(--mc-t-s); margin: .25rem 0 .5rem; }
.mc-pase__datos dt { opacity: .8; }
.mc-pase__datos dd { font-weight: 700; font-size: var(--mc-t-base); }

.mc-vacio { display: grid; justify-items: center; text-align: center; gap: .6rem; padding: 2rem 1.25rem; }
.mc-vacio__icono { width: 4rem; height: 4rem; font-size: 2.25rem; border-radius: 18px; }
.mc-vacio h2 { font-size: var(--mc-t-xl); }

.mc-accesos { display: grid; gap: .6rem; align-content: start; }
.mc-acceso { display: flex; align-items: center; gap: .85rem; padding: .85rem 1rem; text-align: left; color: var(--mc-texto); text-decoration: none; box-shadow: none; transition: border-color .15s ease, transform .15s ease; }
.mc-acceso:hover { border-color: var(--mc-claro); }
.mc-acceso b { display: block; }
.mc-acceso small { display: block; color: var(--mc-suave); font-size: var(--mc-t-s); line-height: 1.35; }
.mc-acceso__flecha { margin-left: auto; color: var(--mc-suave); flex: none; }

.mc-lista h2 { font-size: var(--mc-t-l); margin-bottom: .75rem; }
.mc-lista ul { display: grid; gap: .6rem; }
.mc-mini { display: flex; align-items: center; gap: .85rem; padding: .75rem; color: var(--mc-texto); text-decoration: none; box-shadow: none; }
.mc-mini:hover { border-color: var(--mc-claro); }
.mc-mini__icono { flex: none; width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; font: 800 20px var(--mc-fuente-titulos); background: var(--mc-hielo); color: var(--mc-enlace); }
.mc-mini__icono--vencida { background: var(--mc-esp-fondo); color: var(--mc-esp); }
.mc-mini__icono--revocada { background: var(--mc-no-fondo); color: var(--mc-no); }
.mc-mini__texto { min-width: 0; }
.mc-mini__texto b { display: block; line-height: 1.25; }
.mc-mini__texto small { color: var(--mc-suave); font-size: var(--mc-t-s); }
.mc-mini__flecha { margin-left: auto; color: var(--mc-suave); flex: none; font-size: 1.2rem; }

@media (min-width: 768px) {
  .mc-inicio__cabeza { padding: 2.5rem 0 6.5rem; }
  .mc-inicio__cabeza h1 { font-size: var(--mc-t-3xl); }
  .mc-inicio__rejilla { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 1.25rem; }
  .mc-pase { padding: 1.75rem; }
  .mc-pase__nombre { font-size: var(--mc-t-2xl); }
}
</style>
