<script setup lang="ts">
import QRCode from 'qrcode'
import { safeHttpUrl } from '~/utils/portal'
definePageMeta({ middleware: ['auth'], layout: false })
const branding = useBranding()
const { t, formatDate } = useI18n()
const route = useRoute()
const id = String(route.params.id || '')
const { holderData, holderLoading } = useHolderCredential(id)
const credential = computed(() => holderData.value?.credential)
const raw = computed(() => holderData.value?.rawCredential)
const verifyUrl = `${useWebsiteUrl()}/credentials/${encodeURIComponent(id)}`
const qr = ref('')
const image = computed(() => {
  const badge = credential.value?.credentialSubject?.achievement?.image
  return safeHttpUrl(typeof badge === 'string' ? badge : badge?.id)
})
const results = computed(() => {
  const subject = credential.value?.credentialSubject
  return (subject?.result || []).map((result: any) => {
    const criterion = subject?.achievement?.resultDescription?.find((d: any) => d.id === result.resultDescription)
    const level = criterion?.rubricCriterionLevel?.find((l: any) => l.id === result.achievedLevel)
    return { name: criterion?.name || result.resultDescription, value: level?.name || result.value || result.status, detail: level?.description }
  })
})
const printing = ref(false)
async function printPdf() {
  printing.value = true
  try {
    await document.fonts.ready
    await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})))
    window.print()
  } finally { printing.value = false }
}
onMounted(async () => { qr.value = await QRCode.toDataURL(verifyUrl, { width: 180, margin: 2 }) })
useHead({ title: () => t('portal.holder.printTitle'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <main class="print-page">
    <div class="print-controls">
      <NuxtLink :to="`/credentials/${encodeURIComponent(id)}`" class="underline">{{ t('nav.myCredentials') }}</NuxtLink>
      <p>{{ t('portal.holder.pdfHelp') }}</p>
      <button v-if="credential" class="brand-button" :disabled="printing || !qr" @click="printPdf">{{ t('portal.holder.pdf') }}</button>
    </div>
    <p v-if="holderLoading">{{ t('portal.holder.loading') }}</p>
    <article v-else-if="credential" class="print-sheet">
      <header>
        <p class="issuer">{{ branding.name }}</p>
        <img v-if="image" :src="image" :alt="t('portal.holder.badgeAlt', { name: credential.name || '' })" class="badge">
        <h1>{{ credential.name }}</h1>
        <p class="holder-name">{{ raw?.recipient?.name }}</p>
        <p>{{ credential.description }}</p>
      </header>
      <dl>
        <dt>{{ t('credential.issuer') }}</dt><dd>{{ credential.issuer?.name }}</dd>
        <dt>{{ t('credential.issuedOn') }}</dt><dd>{{ formatDate(credential.validFrom || credential.issuanceDate) }}</dd>
        <template v-if="credential.credentialSubject?.awardedDate"><dt>{{ t('credential.awardedOn') }}</dt><dd>{{ formatDate(credential.credentialSubject.awardedDate, { dateStyle: 'long', timeZone: 'UTC' }) }}</dd></template>
        <dt>{{ t('credential.expiresOn') }}</dt><dd>{{ (credential.validUntil || credential.expirationDate) ? formatDate(credential.validUntil || credential.expirationDate) : t('credential.noExpiration') }}</dd>
      </dl>
      <table v-if="results.length">
        <caption>{{ t('credential.results') }}</caption>
        <tbody><tr v-for="(result, i) in results" :key="i"><th scope="row">{{ result.name }}</th><td>{{ result.value }}<p v-if="result.detail">{{ result.detail }}</p></td></tr></tbody>
      </table>
      <footer>
        <img v-if="qr" :src="qr" :alt="t('portal.holder.qrAlt')" width="140" height="140">
        <p>{{ t('portal.holder.verification') }}</p>
        <a :href="verifyUrl">{{ verifyUrl }}</a>
        <p v-if="raw?.publicLinkActive === false">{{ t('portal.holder.privatePrint') }}</p>
        <p>{{ holderData?.verified ? t('verifier.verified') : t('verifier.failed') }}</p>
      </footer>
    </article>
    <p v-else role="alert">{{ t('portal.holder.unavailable') }}</p>
  </main>
</template>

<style scoped>
.print-page { background: #edf1f5; color: #182330; min-height: 100vh; padding: 2rem 1rem; }
.print-controls { max-width: 180mm; margin: 0 auto 2rem; }
.print-controls p { margin: 1rem 0; }
.print-sheet { background: white; width: 100%; max-width: 210mm; min-height: 297mm; margin: auto; padding: 18mm; box-sizing: border-box; }
header { border-bottom: 3px solid var(--brand-primary); padding-bottom: 1rem; }
h1 { font-size: 26pt; line-height: 1.2; margin: 1rem 0; }
p { line-height: 1.5; }
.issuer { font-weight: 700; font-size: 16pt; }
.holder-name { font-size: 20pt; margin-bottom: 1rem; }
.badge { max-width: 32mm; max-height: 32mm; object-fit: contain; margin-top: 1rem; }
dl { display: grid; grid-template-columns: 1fr 2fr; gap: .7rem; margin: 1.5rem 0; }
dt, th { font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
caption { text-align: left; font-size: 16pt; font-weight: 600; margin-bottom: .75rem; }
th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #ccd2d8; padding: .6rem; }
footer { margin-top: 1.5rem; border-top: 1px solid #ccd2d8; padding-top: 1rem; }
footer a { overflow-wrap: anywhere; text-decoration: underline; }
@page { size: A4; margin: 15mm; }
@media print {
  .print-controls { display: none; }
  .print-page { background: white; padding: 0; }
  .print-sheet { padding: 0; min-height: auto; max-width: none; }
  header, tr, footer { break-inside: avoid; }
}
@media (max-width: 600px) { .print-sheet { padding: 1.25rem; min-height: auto; } h1 { font-size: 22pt; } }
</style>
