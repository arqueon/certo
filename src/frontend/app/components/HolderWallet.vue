<script setup lang="ts">
import QRCode from 'qrcode'
import { apiClient } from '~/api/api-client'
import { walletCountdown } from '~/utils/wallet'

// compacto: dentro de la tarjeta destacada de la portada (fondo con degradado).
// agregar: solo el botón «Agregar una cartera» (página Mis carteras).
const props = defineProps<{ credentialId: string, compacto?: boolean, agregar?: boolean }>()
const { t, locale } = useI18n()
const config = useRuntimeConfig()
const appUrl = String(config.public.walletAppUrl || '').trim()
const appName = String(config.public.walletAppName || 'Cartera UdeG')
interface PendingWallet { offerId: number, client: 'web' | 'app' | null, name: string | null, requestedAt: string }
interface Summary { eligible: boolean, legacy: boolean, revoked?: boolean, revocationReason?: string, rejectedWallet?: boolean, pendingWallet?: PendingWallet | null, walletCount: number, copies: { holderDid: string, boundAt: string, credentialId: string }[] }
interface Offer { exchangeUrl: string, walletUrl: string, qrContent: string, interactionUrl?: string, deepLink?: string, webWalletUrl?: string, expiresAt: string }
const branding = useBranding()
const carteras = useCarteraPendiente()
// Dónde guarda la persona su cartera (14-oct-2026): cada caso con su camino.
// La última elección se recuerda en este equipo.
type Modo = 'app' | 'web' | 'otro'
const CLAVE_MODO = 'mc-cartera-modo'
const modo = ref<Modo>('app')
function elegir(valor: Modo) {
  modo.value = valor
  try { localStorage.setItem(CLAVE_MODO, valor) }
  catch { /* sin almacenamiento: solo dura esta visita */ }
}
// La cartera web institucional abre la oferta en su página de solicitud (ruta con #).
const webWalletUrl = computed(() => {
  if (!offer.value) { return '' }
  if (offer.value.webWalletUrl) { return offer.value.webWalletUrl }
  if (!appUrl) { return '' }
  try {
    const url = new URL(appUrl)
    url.search = ''
    url.hash = `/request?request=${encodeURIComponent(JSON.stringify({ protocols: { vcapi: offer.value.exchangeUrl } }))}`
    return url.href
  }
  catch { return '' }
})
const enlace = computed(() => offer.value ? (offer.value.interactionUrl || offer.value.exchangeUrl) : '')
const copiado = ref(false)
async function copiar() {
  copiado.value = false
  try { await navigator.clipboard.writeText(enlace.value); copiado.value = true; setTimeout(() => { copiado.value = false }, 4000) }
  catch { copiado.value = false }
}
const summary = ref<Summary | null>(null)
const offer = ref<Offer | null>(null)
const qr = ref('')
// One QR for every wallet: the VCALM interaction URL. Wallets read it as JSON;
// a phone camera opens Certo's page with one button per wallet.
const qrUrl = computed(() => offer.value ? (offer.value.interactionUrl || offer.value.qrContent) : '')
const busy = ref(false)
// A new wallet scanned the code: the holder confirms it here (decision of 7-oct-2026).
const deciding = ref(false)
const decided = ref<'approved' | 'refused' | null>(null)
const pendingLabel = computed(() => {
  const wallet = summary.value?.pendingWallet
  if (!wallet) { return '' }
  if (wallet.client === 'web') { return wallet.name ? t('portal.wallet.walletWebNamed', { name: wallet.name }) : t('portal.wallet.walletWeb') }
  return wallet.client === 'app' ? t('portal.wallet.walletApp') : t('portal.wallet.walletUnknownShort')
})
async function decide(approve: boolean) {
  const wallet = summary.value?.pendingWallet
  if (!wallet) { return }
  deciding.value = true; failed.value = false
  try {
    if (!await carteras.decidir(wallet.offerId, approve)) { failed.value = true; return }
    decided.value = approve ? 'approved' : 'refused'
    await refresh()
  }
  finally { deciding.value = false }
}
// La persona contestó desde el aviso global: este diálogo se pone al día.
watch(() => carteras.version.value, () => {
  const respuesta = carteras.resultado.value
  if (respuesta) { decided.value = respuesta }
  void refresh().catch(() => {})
})
const addingWallet = ref(false)
// El QR, los pasos y el resultado viven en un diálogo modal.
const dialog = ref<HTMLDialogElement | null>(null)
const dialogOpen = ref(false)
const justSaved = ref(false)
function openDialog() {
  dialogOpen.value = true
  const el = dialog.value
  if (el && !el.open) {
    if (typeof el.showModal === 'function') {
      el.showModal()
    }
    else { el.setAttribute('open', '') }
  }
}
function closeDialog() {
  const el = dialog.value
  if (el?.open) {
    if (typeof el.close === 'function') {
      el.close()
    }
    else { el.removeAttribute('open') }
  }
  dialogOpen.value = false
}
const failed = ref(false)
const expanded = ref(false)
const now = ref(Date.now())
const expired = computed(() => !!offer.value && Date.parse(offer.value.expiresAt) <= now.value)
const countdown = computed(() => walletCountdown(offer.value?.expiresAt, now.value))
const base = computed(() => `/api/holder/credentials/${encodeURIComponent(props.credentialId)}`)
let timer: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined
let disposed = false
let generation = 0
let polling = false
let copyCount = 0
async function refresh() {
  if (polling) { return }
  polling = true
  try {
    const response = await apiClient.get<{ data: Summary }>(`${base.value}/wallet-copies`)
    if (disposed) { return }
    summary.value = response.data
    if (response.data.pendingWallet) { decided.value = null }
    if (offer.value && (!response.data.eligible || response.data.copies.length > copyCount)) {
      if (response.data.copies.length > copyCount) { justSaved.value = true }
      offer.value = null; qr.value = ''; stopPolling()
    }
  }
  finally { polling = false }
}
function stopPolling() {
  if (poll) { clearInterval(poll) } poll = undefined
}
async function createOffer(addWallet = false) {
  addingWallet.value = addWallet
  busy.value = true; failed.value = false; expanded.value = true; justSaved.value = false
  openDialog()
  offer.value = null; qr.value = ''; stopPolling()
  const current = ++generation
  try {
    await refresh()
    if (!summary.value?.eligible) { return }
    const response = await apiClient.post<{ data: Offer }>(`${base.value}/wallet-offer`, addWallet ? { addWallet: true } : {})
    const image = await QRCode.toDataURL(response.data.interactionUrl || response.data.qrContent, { width: 320, margin: 4, errorCorrectionLevel: 'M' })
    if (disposed || current !== generation) { return }
    copyCount = summary.value.copies.length; decided.value = null
    now.value = Date.now(); offer.value = response.data; qr.value = image
    carteras.vigilarHasta(response.data.expiresAt)
    poll = setInterval(() => { void refresh().catch(() => {}) }, 5000)
  }
  catch {
    if (!disposed && current === generation) { failed.value = true }
  }
  finally {
    if (!disposed && current === generation) { busy.value = false }
  }
}
// Back from the wallet on the same phone: look for a wallet waiting right away.
function onVisible() {
  if (document.visibilityState === 'visible') { void refresh().catch(() => {}) }
}
onMounted(() => {
  let guardado: string | null = null
  try { guardado = localStorage.getItem(CLAVE_MODO) }
  catch { guardado = null }
  if (guardado === 'app' || guardado === 'web' || guardado === 'otro') { modo.value = guardado }
  else { modo.value = window.matchMedia('(pointer: coarse)').matches ? 'app' : (appUrl ? 'web' : 'otro') }
  document.addEventListener('visibilitychange', onVisible)
  void refresh().catch(() => { failed.value = true })
  timer = setInterval(() => {
    now.value = Date.now(); if (expired.value) { stopPolling() }
  }, 1000)
})
onBeforeUnmount(() => {
  closeDialog(); document.removeEventListener('visibilitychange', onVisible); disposed = true; generation++; if (timer) { clearInterval(timer) } stopPolling()
})
</script>

<template>
  <section class="holder-wallet" :class="{ 'hw--compacto': compacto }" :aria-label="t('portal.wallet.save')" data-testid="holder-wallet">
    <div class="hw-acciones">
      <button v-if="agregar" class="mc-boton wallet-add-page" :disabled="busy || (!!summary && !summary.eligible)" aria-haspopup="dialog" @click="createOffer(true)">
        <span class="i-heroicons-plus" aria-hidden="true" />
        {{ t('portal.b.wallets.add') }}
      </button>
      <button v-else class="mc-boton wallet-save" :class="{ 'mc-boton--claro': compacto }" :disabled="busy || (!!summary && !summary.eligible)" :aria-expanded="expanded" aria-haspopup="dialog" @click="createOffer()">
        <span class="i-heroicons-wallet" aria-hidden="true" />
        {{ busy ? t('portal.wallet.creating') : t('portal.wallet.save') }}
      </button>
      <slot />
    </div>

    <template v-if="!agregar">
      <p v-if="summary?.legacy" class="hw-nota">
        {{ t('portal.wallet.legacy') }}
      </p>
      <p v-else-if="summary?.revoked" class="hw-nota wallet-revoked">
        <strong>{{ t('portal.wallet.revoked') }}</strong>
        <span v-if="summary.revocationReason"> · {{ summary.revocationReason }}</span>
      </p>
      <p v-else-if="summary && !summary.eligible" class="hw-nota">
        {{ t('portal.wallet.unavailable') }}
      </p>

      <p v-if="summary?.copies.length" class="hw-nota hw-guardada" aria-live="polite">
        <span class="i-heroicons-check-circle" aria-hidden="true" />
        <span>{{ t(summary.walletCount === 1 ? 'portal.wallet.savedOne' : 'portal.wallet.saved', { count: summary.walletCount }) }}</span>
        <button v-if="summary.eligible" class="mc-boton mc-boton--texto wallet-add" :disabled="busy" @click="createOffer(true)">
          {{ t('portal.wallet.addAnother') }}
        </button>
      </p>

      <div v-if="summary?.pendingWallet && !dialogOpen && !branding.active" role="alert" class="mc-aviso mc-aviso--esp wallet-pending" data-testid="wallet-pending">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-device-phone-mobile" /></span>
        <div class="hw-pendiente">
          <p class="hw-pendiente__titulo">
            {{ t('portal.wallet.pendingTitle') }}
          </p>
          <p>{{ t('portal.wallet.pendingWhich', { wallet: pendingLabel }) }}</p>
          <div class="hw-pendiente__botones">
            <button class="mc-boton wallet-approve" :disabled="deciding" @click="decide(true)">
              {{ t('portal.wallet.pendingApprove') }}
            </button>
            <button class="mc-boton mc-boton--secundario wallet-refuse" :disabled="deciding" @click="decide(false)">
              {{ t('portal.wallet.pendingRefuse') }}
            </button>
          </div>
        </div>
      </div>
      <p v-else-if="decided && !dialogOpen" role="status" class="hw-nota wallet-decided">
        {{ t(decided === 'approved' ? 'portal.wallet.pendingApproved' : 'portal.wallet.pendingRefused') }}
      </p>
      <p v-else-if="summary?.rejectedWallet && !dialogOpen" role="alert" class="mc-aviso mc-aviso--no hw-nota wallet-rejected">
        {{ t('portal.wallet.rejected') }}
      </p>
      <p v-if="failed && !dialogOpen" role="alert" class="hw-nota hw-error">
        {{ t('portal.wallet.error') }}
      </p>

      <details v-if="!compacto && summary?.copies.length" class="hw-copias">
        <summary>{{ t('portal.b.wallet.copies') }}</summary>
        <ul>
          <li v-for="copy in summary.copies" :key="copy.credentialId">
            {{ t('portal.wallet.savedOn') }} <time :datetime="copy.boundAt">{{ new Date(copy.boundAt).toLocaleString(locale) }}</time>
          </li>
        </ul>
        <p>{{ t(appUrl ? 'portal.wallet.confirmSavedApp' : 'portal.wallet.confirmSaved') }}</p>
        <p>{{ t('portal.wallet.sharedRevocation') }}</p>
      </details>

    </template>

    <dialog ref="dialog" class="hw-dialogo mc-tarjeta" :aria-labelledby="`hw-titulo-${credentialId}`" @close="dialogOpen = false" @cancel="dialogOpen = false">
      <header class="hw-dialogo__cabeza">
        <h2 :id="`hw-titulo-${credentialId}`" class="mc-titulo">
          {{ addingWallet ? t('portal.b.wallet.addTitle') : t('portal.b.wallet.title') }}
        </h2>
        <button class="hw-cerrar" :aria-label="t('common.close')" @click="closeDialog">
          <span class="i-heroicons-x-mark" aria-hidden="true" />
        </button>
      </header>

      <div v-if="summary?.pendingWallet" role="alert" class="mc-aviso mc-aviso--esp wallet-pending" data-testid="wallet-pending">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-device-phone-mobile" /></span>
        <div class="hw-pendiente">
          <p class="hw-pendiente__titulo">
            {{ t('portal.wallet.pendingTitle') }}
          </p>
          <p>{{ t('portal.wallet.pendingWhich', { wallet: pendingLabel }) }}</p>
          <div class="hw-pendiente__botones">
            <button class="mc-boton wallet-approve" :disabled="deciding" @click="decide(true)">
              {{ t('portal.wallet.pendingApprove') }}
            </button>
            <button class="mc-boton mc-boton--secundario wallet-refuse" :disabled="deciding" @click="decide(false)">
              {{ t('portal.wallet.pendingRefuse') }}
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="justSaved || decided === 'approved'" class="hw-exito" role="status">
        <span class="hw-exito__icono i-heroicons-check-badge" aria-hidden="true" />
        <p class="mc-titulo hw-exito__titulo">
          {{ t('portal.b.wallet.savedTitle') }}
        </p>
        <p v-if="decided === 'approved'" class="wallet-decided">
          {{ t('portal.wallet.pendingApproved') }}
        </p>
        <p>{{ t(appUrl ? 'portal.wallet.confirmSavedApp' : 'portal.wallet.confirmSaved') }}</p>
        <button class="mc-boton" @click="closeDialog">
          {{ t('portal.b.wallet.done') }}
        </button>
      </div>
      <template v-else>
        <p v-if="decided === 'refused'" role="status" class="hw-nota wallet-decided">
          {{ t('portal.wallet.pendingRefused') }}
        </p>
        <p v-if="summary?.rejectedWallet && !offer" role="alert" class="mc-aviso mc-aviso--no hw-nota wallet-rejected">
          {{ t('portal.wallet.rejected') }}
        </p>
        <div v-if="busy && !offer" class="hw-cargando" role="status">
          <span class="hw-giro" aria-hidden="true" />{{ t('portal.wallet.creating') }}
        </div>
        <div v-if="offer && !expired" class="hw-oferta">
          <fieldset class="hw-modos">
            <legend>{{ t('portal.b.wallet.where') }}</legend>
            <div class="hw-modos__opciones" role="radiogroup">
              <button
                v-for="opcion in (['app', 'web', 'otro'] as const)" :key="opcion" type="button" role="radio"
                class="hw-modo" :class="`hw-modo--${opcion}`" :aria-checked="modo === opcion" @click="elegir(opcion)"
              >
                <span :class="{ app: 'i-heroicons-device-phone-mobile', web: 'i-heroicons-computer-desktop', otro: 'i-heroicons-arrows-right-left' }[opcion]" aria-hidden="true" />
                {{ t(`portal.b.wallet.mode.${opcion}`, { name: appName }) }}
              </button>
            </div>
          </fieldset>

          <template v-if="modo === 'app'">
            <ol class="hw-pasos">
              <li><span>1</span>{{ t('portal.b.wallet.step1', { name: appName }) }}</li>
              <li><span>2</span>{{ t('portal.b.wallet.step2') }}</li>
              <li><span>3</span>{{ t('portal.b.wallet.step3') }}</li>
            </ol>
            <div class="hw-qr hw-qr--app">
              <img :src="qr" :alt="t('portal.wallet.appQrAlt', { name: appName })" class="wallet-qr" width="320" height="320">
            </div>
            <a :href="qrUrl" rel="noreferrer" class="mc-boton wallet-open">{{ t('portal.b.wallet.openApp', { name: appName }) }}</a>
          </template>

          <template v-else-if="modo === 'web'">
            <ol class="hw-pasos">
              <li><span>1</span>{{ t('portal.b.wallet.web1', { name: appName }) }}</li>
              <li><span>2</span>{{ t('portal.b.wallet.web2') }}</li>
              <li><span>3</span>{{ t('portal.b.wallet.web3') }}</li>
            </ol>
            <a v-if="webWalletUrl" :href="webWalletUrl" target="_blank" rel="noopener" class="mc-boton wallet-open-web">
              <span class="i-heroicons-arrow-top-right-on-square" aria-hidden="true" />{{ t('portal.b.wallet.openWeb', { name: appName }) }}
            </a>
            <div class="hw-copiar">
              <p class="hw-ayuda">
                {{ t('portal.b.wallet.pasteHelp', { name: appName }) }}
              </p>
              <button type="button" class="mc-boton mc-boton--secundario wallet-copy" @click="copiar">
                <span :class="copiado ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" aria-hidden="true" />{{ copiado ? t('portal.b.wallet.copied') : t('portal.b.wallet.copy') }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="hw-ayuda">
              {{ t('portal.b.wallet.otherHelp', { name: appName }) }}
            </p>
            <div class="hw-qr hw-qr--otro">
              <img :src="qr" :alt="t('portal.wallet.appQrAlt', { name: appName })" class="wallet-qr" width="320" height="320">
            </div>
            <button type="button" class="mc-boton mc-boton--secundario wallet-copy" @click="copiar">
              <span :class="copiado ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" aria-hidden="true" />{{ copiado ? t('portal.b.wallet.copied') : t('portal.b.wallet.copy') }}
            </button>
          </template>

          <p role="timer" aria-live="off" class="mc-chip mc-chip--esp hw-reloj">
            {{ t('portal.wallet.expires', { time: countdown }) }}
          </p>
          <p class="hw-espera" role="status">
            <span class="hw-giro hw-giro--chico" aria-hidden="true" />{{ t('portal.b.wallet.waiting') }}
          </p>
          <p v-if="addingWallet" class="mc-aviso mc-aviso--esp hw-nota">
            {{ t('portal.wallet.addingHelp') }}
          </p>
          <p class="hw-nota mc-suave">
            {{ t('portal.wallet.once') }}
          </p>
        </div>
        <div v-if="expired" class="hw-vencido" role="status">
          <span class="i-heroicons-clock" aria-hidden="true" />
          <p>{{ t('portal.wallet.expired') }}</p>
        </div>
        <p v-if="failed" role="alert" class="mc-aviso mc-aviso--no hw-nota">
          {{ t('portal.wallet.error') }}
        </p>
        <button v-if="offer || failed" class="mc-boton" :class="{ 'mc-boton--secundario': !expired && !failed }" :disabled="busy" @click="createOffer(addingWallet)">
          {{ t('portal.wallet.new') }}
        </button>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.holder-wallet { overflow-wrap: anywhere; scroll-margin-top: 6rem; display: grid; gap: .75rem; }
.hw-acciones { display: flex; flex-wrap: wrap; gap: .5rem; }
.hw--compacto .hw-acciones > * { flex: 1 1 12rem; }
.hw-nota { font-size: var(--mc-t-s); line-height: 1.5; }
.hw--compacto > .hw-nota:not(.mc-aviso) { color: rgba(255, 255, 255, .9); }
.hw-guardada { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .5rem; }
.hw-guardada > span:first-child { color: var(--mc-ok); font-size: 1.1rem; }
.hw--compacto > .hw-guardada > span:first-child { color: #7fe0b8; }
.hw--compacto > .hw-guardada .wallet-add { color: #fff; }
.hw-error { color: var(--mc-no); }
.hw--compacto > .hw-error { color: #fff; font-weight: 700; }
.hw-pendiente { display: grid; gap: .5rem; color: var(--mc-texto); }
.hw-pendiente__titulo { font-weight: 800; font-family: var(--mc-fuente-titulos); font-size: var(--mc-t-l); }
.hw-pendiente__botones { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .25rem; }
.hw-copias { font-size: var(--mc-t-s); color: var(--mc-suave); }
.hw-copias summary { cursor: pointer; color: var(--mc-enlace); font-weight: 600; }
.hw-copias ul, .hw-copias p { margin-top: .5rem; }

.hw-dialogo { width: min(30rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 1.25rem; color: var(--mc-texto); overflow-y: auto; }
.hw-dialogo[open] { display: grid; gap: 1rem; }
.hw-dialogo::backdrop { background: rgba(14, 19, 34, .62); backdrop-filter: blur(3px); }
.hw-dialogo__cabeza { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.hw-dialogo__cabeza h2 { font-size: var(--mc-t-xl); }
.hw-cerrar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; font-size: 1.4rem; color: var(--mc-suave); }
.hw-cerrar:hover { background: var(--mc-hielo); color: var(--mc-texto); }
.hw-oferta { display: grid; gap: .9rem; }
.hw-pasos { display: grid; gap: .5rem; counter-reset: none; }
.hw-pasos li { display: flex; align-items: center; gap: .65rem; font-weight: 600; }
.hw-pasos span { flex: none; display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--mc-hielo); color: var(--mc-enlace); font: 800 var(--mc-t-s) var(--mc-fuente-titulos); }
.hw-ayuda { font-size: var(--mc-t-s); color: var(--mc-suave); }
.hw-qr { position: relative; justify-self: center; display: grid; justify-items: center; gap: .6rem; }
.wallet-qr { display: block; width: 240px; max-width: 100%; height: auto; background: white; border-radius: 14px; border: 1px solid var(--mc-linea); }
.hw-reloj { font-variant-numeric: tabular-nums; }
.wallet-open { display: none; }
.hw-modos { border: 0; padding: 0; margin: 0; display: grid; gap: .5rem; }
.hw-modos legend { font-weight: 700; font-size: var(--mc-t-s); color: var(--mc-suave); margin-bottom: .4rem; }
.hw-modos__opciones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4rem; }
.hw-modo { display: grid; justify-items: center; gap: .3rem; padding: .65rem .4rem; border-radius: var(--mc-r-s); border: 1.5px solid var(--mc-linea); background: var(--mc-superficie); color: var(--mc-texto); font-size: var(--mc-t-xs); font-weight: 700; line-height: 1.25; text-align: center; }
.hw-modo span { font-size: 1.35rem; color: var(--mc-enlace); }
.hw-modo[aria-checked='true'] { border-color: var(--mc-enlace); background: var(--mc-hielo); box-shadow: inset 0 0 0 1px var(--mc-enlace); }
.wallet-open-web { justify-self: stretch; justify-content: center; gap: .5rem; }
.hw-copiar { display: grid; gap: .5rem; padding: .85rem; border-radius: var(--mc-r-s); background: var(--mc-hielo); }
.hw-copiar .wallet-copy, .hw-oferta > .wallet-copy { justify-self: start; gap: .45rem; }
.hw-reloj { justify-self: center; }
.hw-espera { display: flex; align-items: center; justify-content: center; gap: .5rem; font-size: var(--mc-t-s); color: var(--mc-suave); }
.hw-giro--chico { width: 1rem; height: 1rem; border-width: 2px; }
.hw-cargando { display: flex; align-items: center; gap: .75rem; padding: 2rem 0; justify-content: center; color: var(--mc-suave); }
.hw-giro { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 3px solid var(--mc-linea); border-top-color: var(--mc-enlace); animation: hw-giro .8s linear infinite; }
@keyframes hw-giro { to { transform: rotate(360deg); } }
.hw-vencido { display: grid; justify-items: center; gap: .5rem; text-align: center; padding: 1rem; color: var(--mc-suave); }
.hw-vencido span { font-size: 2.25rem; color: var(--mc-esp); }
.hw-exito { display: grid; justify-items: center; gap: .6rem; text-align: center; padding: .5rem 0 .25rem; }
.hw-exito__icono { font-size: 3.5rem; color: var(--mc-ok); }
.hw-exito__titulo { font-size: var(--mc-t-xl); }
@media (max-width: 767px), (pointer: coarse) {
  .wallet-open { display: inline-flex; justify-content: center; }
  .hw-qr--app { display: none; }
  .hw-dialogo { margin: auto auto 0; width: 100vw; max-width: 100vw; border-radius: 22px 22px 0 0; }
}
</style>
