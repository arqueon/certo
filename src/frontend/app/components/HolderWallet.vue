<script setup lang="ts">
import QRCode from 'qrcode'
import { apiClient } from '~/api/api-client'
import { walletCountdown, shortWalletDid } from '~/utils/wallet'

const props = defineProps<{ credentialId: string }>()
const { t, locale } = useI18n()
interface Summary { eligible: boolean; legacy: boolean; walletCount: number; copies: { holderDid: string; boundAt: string; credentialId: string }[] }
interface Offer { walletUrl: string; qrContent: string; expiresAt: string }
const summary = ref<Summary | null>(null)
const offer = ref<Offer | null>(null)
const qr = ref('')
const busy = ref(false)
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
  if (polling) return
  polling = true
  try {
    const response = await apiClient.get<{ data: Summary }>(`${base.value}/wallet-copies`)
    if (disposed) return
    summary.value = response.data
    if (offer.value && (!response.data.eligible || response.data.copies.length > copyCount)) {
      offer.value = null; qr.value = ''; stopPolling()
    }
  } finally { polling = false }
}
function stopPolling() { if (poll) clearInterval(poll); poll = undefined }
async function createOffer() {
  busy.value = true; failed.value = false; expanded.value = true
  offer.value = null; qr.value = ''; stopPolling()
  const current = ++generation
  try {
    await refresh()
    if (!summary.value?.eligible) return
    const response = await apiClient.post<{ data: Offer }>(`${base.value}/wallet-offer`, {})
    const image = await QRCode.toDataURL(response.data.qrContent, { width: 320, margin: 4, errorCorrectionLevel: 'M' })
    if (disposed || current !== generation) return
    copyCount = summary.value.copies.length
    now.value = Date.now(); offer.value = response.data; qr.value = image
    poll = setInterval(() => { void refresh().catch(() => {}) }, 5000)
  } catch { if (!disposed && current === generation) failed.value = true }
  finally { if (!disposed && current === generation) busy.value = false }
}
onMounted(() => {
  void refresh().catch(() => { failed.value = true })
  timer = setInterval(() => { now.value = Date.now(); if (expired.value) stopPolling() }, 1000)
})
onBeforeUnmount(() => { disposed = true; generation++; if (timer) clearInterval(timer); stopPolling() })
</script>

<template>
  <section class="holder-wallet my-4 space-y-3" :aria-label="t('portal.wallet.save')" data-testid="holder-wallet">
    <button class="brand-button" :disabled="busy || (!!summary && !summary.eligible)" :aria-expanded="expanded" @click="createOffer">
      {{ busy ? t('portal.wallet.creating') : t('portal.wallet.save') }}
    </button>
    <p v-if="summary?.legacy">{{ t('portal.wallet.legacy') }}</p>
    <p v-else-if="summary && !summary.eligible">{{ t('portal.wallet.unavailable') }}</p>
    <div v-if="expanded" class="space-y-3">
      <p>{{ t('portal.wallet.help') }} <a href="https://lcw.app/" target="_blank" rel="noopener noreferrer" class="underline">Learner Credential Wallet (LCW)</a>.</p>
      <p>{{ t('portal.wallet.once') }}</p>
      <p>{{ t('portal.wallet.publicQr') }}</p>
      <div v-if="offer && !expired" class="space-y-3">
        <img :src="qr" :alt="t('portal.wallet.qrAlt')" class="wallet-qr" width="320" height="320">
        <p role="timer" aria-live="off">{{ t('portal.wallet.expires', { time: countdown }) }}</p>
        <a :href="offer.walletUrl" rel="noreferrer" class="brand-button wallet-open">{{ t('portal.wallet.open') }}</a>
      </div>
      <p v-if="expired" role="status">{{ t('portal.wallet.expired') }}</p>
      <button v-if="offer" class="underline" :disabled="busy" @click="createOffer">{{ t('portal.wallet.new') }}</button>
    </div>
    <p v-if="failed" role="alert">{{ t('portal.wallet.error') }}</p>
    <div v-if="summary?.copies.length" class="space-y-2" aria-live="polite">
      <p class="font-semibold">{{ t(summary.walletCount === 1 ? 'portal.wallet.savedOne' : 'portal.wallet.saved', { count: summary.walletCount }) }}</p>
      <ul class="space-y-2">
        <li v-for="copy in summary.copies" :key="copy.credentialId">
          <abbr :title="copy.holderDid">{{ shortWalletDid(copy.holderDid) }}</abbr>
          · <time :datetime="copy.boundAt">{{ new Date(copy.boundAt).toLocaleString(locale) }}</time>
        </li>
      </ul>
      <p>{{ t('portal.wallet.confirmSaved') }}</p>
      <p>{{ t('portal.wallet.sharedRevocation') }}</p>
    </div>
  </section>
</template>

<style scoped>
.holder-wallet { overflow-wrap: anywhere; scroll-margin-top: 6rem; }
.wallet-qr { display: block; max-width: 100%; height: auto; background: white; }
.wallet-open { display: none; }
@media (max-width: 767px), (pointer: coarse) {
  .wallet-open { display: inline-flex; }
  .wallet-qr { display: none; }
}
</style>
