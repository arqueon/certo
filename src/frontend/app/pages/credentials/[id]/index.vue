<script setup lang="ts">
import type {
  AchievementCredential,
  VerificationResult
} from '~/types/openbadges'
import QRCode from 'qrcode'
import { credentialMetadata, resolvedResults } from '~/utils/credential-metadata'
import { safeHttpUrl } from '~/utils/portal'
import { apiClient } from '~/api/api-client'

const { t, formatDate: formatLocaleDate } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()
const branding = useBranding()

// ============================================================================
// 1. ROUTE PARAMS & STATIC URLs
// ============================================================================
const rawId = route.params.id
const credentialId = rawId
  ? decodeURIComponent((Array.isArray(rawId) ? rawId[0] : rawId) || '')
  : ''

const authStore = useAuthStore()
const { holderData, holderLoading, loadHolder } = useHolderCredential(credentialId)
async function privacySaved() { await loadHolder(); await refresh() }
const websiteUrl = config.public.websiteUrl || WEBSITE_URL
const shareableUrl = `${websiteUrl}/credentials/${encodeURIComponent(credentialId)}`
const ogImageUrl = `${websiteUrl}/.netlify/functions/og-credential?id=${encodeURIComponent(credentialId)}`

// ============================================================================
// 2. DATA FETCHING
// ============================================================================
// For SSR meta tags to work, the API must be reachable from the Nuxt server process.
// In local dev: set NUXT_PUBLIC_API_URL to your backend (e.g., http://127.0.0.1:1337)
// In production: set to your production API URL

const apiUrl = config.public.apiUrl || ''

// useAsyncData fetches on server (SSR) and hydrates on client
// We catch errors to prevent page crash, but data will be null if fetch fails
const { data: verificationData, error: fetchError, status, refresh } = await useAsyncData<VerificationResult | null>(
  `credential-${credentialId}`,
  async () => {
    if (!credentialId) return null

    const url = `${apiUrl}/api/credentials/${encodeURIComponent(credentialId)}/verify`
    console.log(`[${import.meta.server ? 'SSR' : 'Client'}] Fetching: ${url}`)

    try {
      const result = await $fetch<VerificationResult>(url)
      console.log(`[${import.meta.server ? 'SSR' : 'Client'}] Fetch success:`, result?.credential?.name || result?.rawCredential?.name)
      return result
    }
    catch (err) {
      console.error(`[${import.meta.server ? 'SSR' : 'Client'}] Fetch failed:`, err)
      // Return null instead of throwing - page will render with fallback meta tags
      return null
    }
  },
  {
    // Nuxt 3.10+ options
    server: true,   // Fetch on server for SSR
    lazy: false,    // Block render until fetch completes (needed for SEO)
    default: () => null,
  }
)

// Client-side retry if SSR fetch failed (e.g., localhost not reachable from server)
onMounted(async () => {
  if (!verificationData.value && credentialId) {
    console.log('[Client] SSR data missing, retrying with apiClient...')
    try {
      verificationData.value = await apiClient.verifyBadge(credentialId)
      console.log('[Client] Retry success:', verificationData.value?.credential?.name)
    }
    catch (err) {
      console.error('[Client] Retry failed:', err)
    }
  }
})

// Client-only, same as the navigator.share() call in shareCredential() below -
// avoids an SSR/hydration special case for a supplementary feature.
const qrCodeDataUrl = ref('')
onMounted(async () => {
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(shareableUrl, { width: 160, margin: 1 })
  }
  catch (err) {
    console.error('Error generating QR code:', err)
  }
})

// ============================================================================
// 3. COMPUTED DATA EXTRACTION
// ============================================================================
const credential = computed<AchievementCredential | null>(() => {
  const data = holderData.value || verificationData.value
  if (!data) return null
  return data.credential || data.rawCredential as AchievementCredential || null
})

const verificationResult = computed(() => holderData.value || verificationData.value)
const info = computed(() => credentialMetadata(credential.value, verificationResult.value?.rawCredential))
const evaluated = computed(() => resolvedResults(credential.value))
const loading = computed(() => status.value === 'pending' && !credential.value)
const error = computed(() => {
  if (fetchError.value) return fetchError.value.message
  if (status.value === 'error' && !verificationData.value && credentialId) {
    return t('credential.fetchFailed')
  }
  return null
})

// ============================================================================
// 4. SEO METADATA
// Per Nuxt 3 docs: use getter functions () => value for reactive meta tags
// https://nuxt.com/docs/api/composables/use-seo-meta
// ============================================================================

// Helper functions to extract data (keeps useSeoMeta clean)
function getCredentialName(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.name || cred?.title || ''
}

function getCredentialDescription(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.description || ''
}

function getIssuerName(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.issuer?.name || branding.name
}

function getRecipientName(): string {
  return verificationData.value?.credential?.credentialSubject?.name || verificationData.value?.rawCredential?.recipient?.name || ''
}

// SEO with getter functions (Nuxt 3 documented pattern)
useSeoMeta({
  // Title
  title: () => {
    const name = getCredentialName()
    return name ? `${name} | ${branding.name}` : `${t('credential.seo.title')} | ${branding.name}`
  },

  // Description
  description: () => {
    const desc = getCredentialDescription()
    if (desc) return desc

    const name = getCredentialName()
    if (name) {
      const issuer = getIssuerName()
      const recipient = getRecipientName()
      return recipient
        ? t('credential.seo.descriptionWithRecipient', { name, recipient, issuer, brand: branding.name })
        : t('credential.seo.description', { name, issuer, brand: branding.name })
    }
    return t('credential.seo.descriptionGeneric', { brand: branding.name })
  },

  // Open Graph
  ogType: 'website',
  ogSiteName: branding.name,
  ogUrl: shareableUrl,
  ogTitle: () => {
    const name = getCredentialName()
    return name ? `${name} | ${branding.name}` : `${t('credential.seo.title')} | ${branding.name}`
  },
  ogDescription: () => {
    const desc = getCredentialDescription()
    if (desc) return desc
    const name = getCredentialName()
    if (name) return t('credential.seo.description', { name, issuer: getIssuerName(), brand: branding.name })
    return t('credential.seo.descriptionGeneric', { brand: branding.name })
  },
  ogImage: ogImageUrl,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => {
    const name = getCredentialName()
    return name ? t('credential.seo.imageAlt', { name }) : t('credential.seo.imageAltGeneric', { brand: branding.name })
  },

  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: () => {
    const name = getCredentialName()
    return name ? `${name} | ${branding.name}` : `${t('credential.seo.title')} | ${branding.name}`
  },
  twitterDescription: () => {
    const desc = getCredentialDescription()
    if (desc) return desc
    const name = getCredentialName()
    if (name) return t('credential.seo.description', { name, issuer: getIssuerName(), brand: branding.name })
    return t('credential.seo.descriptionGeneric', { brand: branding.name })
  },
  twitterImage: ogImageUrl,
  twitterImageAlt: () => {
    const name = getCredentialName()
    return name ? t('credential.seo.imageAlt', { name }) : t('credential.seo.imageAltGeneric', { brand: branding.name })
  },

  // Author
  author: () => getIssuerName(),
})

useHead({
  link: [{ rel: 'canonical', href: shareableUrl }],
  script: [
    {
      // JSON-LD structured data — schema.org EducationalOccupationalCredential
      // Makes credential pages indexable by Google and understandable by AI crawlers
      type: 'application/ld+json',
      innerHTML: () => {
        const cred = verificationData.value?.credential ?? verificationData.value?.rawCredential
        if (!cred) return JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage' })
        return JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'EducationalOccupationalCredential',
          '@id': shareableUrl,
          'name': cred.name ?? cred.title ?? 'Digital Credential',
          'description': cred.description ?? '',
          'url': shareableUrl,
          'credentialCategory': 'badge',
          'dateCreated': cred.validFrom ?? cred.issuanceDate ?? undefined,
          'expires': cred.validUntil ?? cred.expirationDate ?? undefined,
          'recognizedBy': cred.issuer ? {
            '@type': 'Organization',
            'name': typeof cred.issuer === 'string' ? cred.issuer : cred.issuer.name ?? '',
            'url': typeof cred.issuer === 'object' ? cred.issuer.url ?? undefined : undefined,
          } : undefined,
          'image': verificationData.value?.rawCredential?.achievement?.image?.url ?? undefined,
          // Open Badges 3.0 extension
          'identifier': credentialId,
          'publisher': {
            '@type': 'Organization',
            'name': branding.name,
            'url': websiteUrl,
          },
        })
      },
    },
  ],
})

// ============================================================================
// 5. UI HELPERS
// ============================================================================
async function refreshCredentialDetails() {
  await refresh()
  // If useAsyncData refresh failed, try apiClient (client-side only)
  if (!verificationData.value && credentialId && import.meta.client) {
    try {
      verificationData.value = await apiClient.verifyBadge(credentialId)
    }
    catch (err) {
      console.error('Refresh retry failed:', err)
    }
  }
}

// Client-side only state for image handling
const currentImageIndex = ref(0)
const imageLoadError = ref(false)

// Format dates with proper localization
const formattedIssuanceDate = computed(() => {
  const date = credential.value?.validFrom || credential.value?.issuanceDate
  if (!date) return t('credential.unknown')
  return formatDate(date)
})

// Only shown when it exists: a credential earned and issued at the same time
// has no separate achievement date, and showing "the same date twice" would
// be noise. When it does differ, it is the honest origin of the credential.
const formattedAwardedDate = computed(() => {
  const date = credential.value?.awardedDate
    || verificationData.value?.credential?.credentialSubject?.awardedDate
  if (!date) return null
  return formatAwardedDate(date)
})

const formattedExpirationDate = computed(() => {
  const date = credential.value?.validUntil || credential.value?.expirationDate
  if (!date) return t('credential.noExpiration')
  return formatDate(date)
})

// Get all possible image URLs for display
const imageUrlOptions = computed(() => {
  if (!credential.value) return []

  const cred = credential.value
  const rawCred = verificationResult.value?.rawCredential

  const options = [
    safeHttpUrl(cred.credentialSubject?.achievement?.image?.id),
    // Option 2: Raw credential achievement image URL (Strapi format)
    rawCred?.achievement?.image?.url,

    // Option 3: Raw credential achievement image formats (Strapi responsive images)
    rawCred?.achievement?.image?.formats?.large?.url,
    rawCred?.achievement?.image?.formats?.medium?.url,
    rawCred?.achievement?.image?.formats?.small?.url,

    // Option 4: OpenBadges achievement image ID
    typeof cred.credentialSubject?.achievement?.image?.id === 'string'
      ? cred.credentialSubject.achievement.image.id.replace('https://bold-approval-5bde4fbd5d.strapiapp.comhttps://', 'https://')
      : null,

    // Option 5: OpenBadges issuer image
    typeof cred.issuer?.image === 'string' ? cred.issuer.image : null,

    // Último recurso: el certificado SVG generado. Va al final para que la
    // insignia real del logro tenga prioridad cuando existe.
    apiClient.getCertificateUrl(cred.id)
  ].filter(Boolean) as string[]

  return [...new Set(options)]
})

// Get the current image URL based on the current index
const displayImageUrl = computed(() => {
  if (imageUrlOptions.value.length === 0) return null
  return imageUrlOptions.value[currentImageIndex.value]
})

// Handle image error by trying the next URL in the options
function handleImageError() {
  if (currentImageIndex.value < imageUrlOptions.value.length - 1) {
    currentImageIndex.value++
  }
  else {
    imageLoadError.value = true
  }
}

// A day, not an instant. It is captured as a plain date ("20 March 2023")
// and stored as UTC midnight, so formatting it in the viewer's timezone like
// any other timestamp shows the day before for anyone west of UTC - and the
// time-of-day is meaningless noise either way. Read it back in UTC.
function formatAwardedDate(dateString: string) {
  if (!dateString) return null
  return formatLocaleDate(dateString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Date and time in the active locale, not the browser's.
function formatDate(dateString: string) {
  return formatLocaleDate(dateString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }, t('credential.unknown'))
}

async function shareCredential() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: credential.value?.name || t('credential.title'),
        text: t('credential.shareText', { name: credential.value?.name || '' }),
        url: shareableUrl
      })
    }
    else {
      await navigator.clipboard.writeText(shareableUrl)
    }
  }
  catch (err) {
    console.error('Error sharing:', err)
  }
}

function getLinkedInAddToProfileUrl() {
  if (!credential.value) return '#'

  const cert = credential.value
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.name || cert.title || '',
    ...(branding.active ? { organizationName: cert.issuer?.name || branding.name } : { organizationId: '53115782' }),
    issueYear: (cert.validFrom || cert.issuanceDate) ? new Date((cert.validFrom || cert.issuanceDate)!).getFullYear().toString() : '',
    issueMonth: (cert.validFrom || cert.issuanceDate) ? (new Date((cert.validFrom || cert.issuanceDate)!).getMonth() + 1).toString() : '',
    certId: cert.id,
    certUrl: shareableUrl
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

</script>

<template>
  <main class="credential-page">
    <p v-if="loading || (holderLoading && !credential)" role="status">{{ t('credential.loadingVerification') }}</p>
    <section v-else-if="!credential" class="portal-card">
      <h1>{{ t('portal.holder.unavailable') }}</h1>
      <NuxtLink v-if="!authStore.isAuthenticated" to="/login" class="underline">{{ t('portal.holder.ownerLogin') }}</NuxtLink>
    </section>
    <template v-else>
      <header class="portal-card credential-header">
        <img v-if="displayImageUrl && !imageLoadError" :src="displayImageUrl" :alt="`Insignia de ${credential.name}`" class="credential-badge" @error="handleImageError">
        <div class="credential-heading">
          <p v-if="info.holder" class="holder-name">{{ info.holder }}</p>
          <p class="credential-kind">{{ info.kind }}</p>
          <h1>{{ credential.name }}</h1>
          <p class="institution">{{ credential.issuer?.name }}<span v-if="info.creator"> › {{ info.creator }}</span></p>
          <p v-if="info.event">{{ info.event }}</p>
          <p v-if="info.subject.term">Periodo: {{ info.subject.term }}</p>
          <p v-if="info.subject.source?.name">Institución aliada: {{ info.subject.source.name }}</p>
          <details class="verification-seal" :class="{ invalid: !verificationResult?.verified }">
            <summary>{{ verificationResult?.verified ? '✓ Verificada' : 'No verificada' }}<span v-if="verificationResult?.verified"> · {{ (credential.validUntil || credential.expirationDate) ? `vigente hasta ${formatLocaleDate(credential.validUntil || credential.expirationDate, { dateStyle: 'long' })}` : 'sin fecha de vencimiento' }}</span></summary>
            <p>Estas comprobaciones revisan la firma, la vigencia y el estado de la credencial.</p>
            <ul><li v-for="check in verificationResult?.checks" :key="check.check">
              {{ ({ proof: 'Firma del emisor', not_revoked: 'No revocada', not_expired: 'Vigencia', valid_from: 'Inicio de vigencia', format: 'Formato', issuer: 'Emisor', expiration: 'Vencimiento' } as Record<string, string>)[check.check] || 'Comprobación' }}:
              {{ check.result === 'success' ? 'Correcta' : check.result === 'warning' ? 'Requiere revisión' : 'No superada' }}
            </li></ul>
            <button class="underline" @click="refreshCredentialDetails">Actualizar comprobaciones</button>
          </details>
        </div>
      </header>
      <CredentialLearning :credential="credential" :raw="verificationResult?.rawCredential" class="portal-card" />
      <section v-if="evaluated.length || info.criteria" class="portal-card">
        <h2>Cómo se evaluó</h2>
        <p v-if="info.criteria" class="preserve-lines">{{ info.criteria }}</p>
        <dl class="criterion-results"><template v-for="(result, i) in evaluated" :key="i">
          <dt>{{ result.name }}</dt><dd><strong>{{ result.value }}</strong><p v-if="result.detail">{{ result.detail }}</p></dd>
        </template></dl>
      </section>
      <section class="portal-card verification-section">
        <h2>Verificar</h2>
        <p>Abre este enlace o escanea el código para consultar el estado actual de la credencial.</p>
        <div class="verify-link"><img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" :alt="t('portal.holder.qrAlt')" width="160" height="160"><a :href="shareableUrl">{{ shareableUrl }}</a></div>
        <dl class="dates">
          <dt>Fecha de emisión</dt><dd>{{ formattedIssuanceDate }}</dd>
          <template v-if="formattedAwardedDate"><dt>Fecha del logro</dt><dd>{{ formattedAwardedDate }}</dd></template>
          <dt>Vencimiento</dt><dd>{{ formattedExpirationDate }}</dd>
          <template v-if="info.subject.activityStartDate"><dt>Inicio de la actividad</dt><dd>{{ formatAwardedDate(info.subject.activityStartDate) }}</dd></template>
          <template v-if="info.subject.activityEndDate"><dt>Fin de la actividad</dt><dd>{{ formatAwardedDate(info.subject.activityEndDate) }}</dd></template>
        </dl>
        <RecipientCheck :credential-id="credentialId" />
      </section>
      <HolderDownloads v-if="holderData" :credential-id="credentialId" :privacy="holderData.rawCredential" @saved="privacySaved">
        <div class="share-actions">
          <button class="brand-button" @click="shareCredential">Compartir enlace</button>
          <a :href="getLinkedInAddToProfileUrl()" target="_blank" rel="noopener noreferrer" class="brand-button">Añadir a LinkedIn</a>
        </div>
      </HolderDownloads>
    </template>
  </main>
</template>

<style scoped>
.credential-page { max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; overflow-wrap: anywhere; }
.portal-card { margin-bottom: 1.5rem; }
.credential-header { display: flex; align-items: flex-start; gap: 2rem; }
.credential-badge { width: 220px; height: 220px; object-fit: contain; flex-shrink: 0; }
.credential-heading { min-width: 0; }
h1 { font-size: clamp(1.8rem, 4vw, 2.4rem); line-height: 1.2; font-weight: 750; margin: .5rem 0 1rem; }
h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
p { margin: .6rem 0; line-height: 1.6; }
.holder-name { font-size: 1.4rem; font-weight: 600; }
.credential-kind { font-size: .9rem; }
.institution { font-weight: 600; }
.verification-seal { padding: .7rem 1rem; background: #edf7f0; color: #185330; border: 1px solid #a5cbb3; border-radius: .75rem; margin-top: 1.25rem; }
.verification-seal.invalid { background: #fff2ed; color: #852d12; border-color: #d9a597; }
summary { cursor: pointer; font-weight: 600; }
.verification-seal ul { padding-left: 1rem; list-style: disc; }
.verify-link { display: flex; align-items: center; gap: 1.5rem; }
.verify-link img { flex-shrink: 0; }
a { text-decoration: underline; }
.dates, .criterion-results { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: .75rem 1rem; margin: 1rem 0; }
dt { font-weight: 600; }
.preserve-lines { white-space: pre-line; }
.share-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
@media (max-width: 640px) { .credential-header { flex-direction: column; gap: 1rem; } .credential-badge { align-self: center; width: 200px; height: 200px; } .verify-link { flex-direction: column; align-items: flex-start; } .dates, .criterion-results { grid-template-columns: 1fr; gap: .3rem; } dt { margin-top: .5rem; } }
</style>
