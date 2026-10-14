<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { credentialMetadata, didWebDomain, qualificationLabel, resolvedResults, resultAnchor } from '~/utils/credential-metadata'
import { safeHttpUrl } from '~/utils/portal'

// Detalle de una credencial en la dirección B «Insignia viva»: la insignia y su
// estado arriba; lo que acredita y cómo se evaluó a la izquierda; verificar,
// la cartera, las descargas y la privacidad a la derecha (abajo en celular).
// La página pasa los datos ya resueltos y conserva toda la lógica de carga.
const props = defineProps<{
  credentialId: string
  credential: any
  result: any
  holder: any
  imageUrl: string | null
  qr: string
  shareableUrl: string
  dates: { issued: string, awarded: string | null, expires: string }
}>()
const emit = defineEmits<{ imageError: [], share: [], recheck: [], privacySaved: [] }>()
const { t, locale } = useI18n()
const branding = useBranding()
const authStore = useAuthStore()
const mounted = useMounted()
const signedIn = computed(() => mounted.value && authStore.isAuthenticated)

const raw = computed(() => props.result?.rawCredential)
const info = computed(() => credentialMetadata(props.credential, raw.value))
const evaluated = computed(() => resolvedResults(props.credential))
const checks = computed<any[]>(() => props.result?.checks || [])
const failed = (name: string) => checks.value.some(c => c.check === name && c.result === 'error')

const kind = computed(() => {
  const type = info.value.achievement.achievementType
  if (!type) {
    return t('portal.b.kinds.default')
  }
  const label = t(`portal.b.kinds.${type}`)
  return label === `portal.b.kinds.${type}` ? info.value.kind : label
})

const issued = computed(() => props.credential?.validFrom || props.credential?.issuanceDate)
const expiry = computed(() => props.credential?.validUntil || props.credential?.expirationDate)
function day(value?: string) {
  return value ? new Date(value).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}
type Estado = 'vigente' | 'vencida' | 'revocada' | 'invalida'
const estado = computed<Estado>(() => {
  if (raw.value?.revoked || failed('not_revoked')) {
    return 'revocada'
  }
  if (failed('not_expired') || (expiry.value && Date.parse(expiry.value) < Date.now())) {
    return 'vencida'
  }
  return props.result?.verified ? 'vigente' : 'invalida'
})
const chip: Record<Estado, string> = { vigente: 'mc-chip--ok', vencida: 'mc-chip--esp', revocada: 'mc-chip--no', invalida: 'mc-chip--no' }
const estadoTexto = computed(() => {
  if (estado.value !== 'vigente') {
    return t(`portal.b.status.${estado.value}`)
  }
  return expiry.value ? t('portal.b.status.vigenteHasta', { date: day(expiry.value) }) : t('portal.b.status.vigenteSiempre')
})
// El motivo solo si lo escribió el emisor; los mensajes genéricos del servidor van en inglés.
const motivo = computed(() => {
  const own = raw.value?.revocationReason
  if (own && own !== 'No reason provided') {
    return own
  }
  const message = checks.value.find(c => c.check === 'not_revoked')?.message
  return message && !message.startsWith('Credential ') ? message : ''
})

const evidence = computed(() => {
  const list = props.credential?.evidence || raw.value?.evidence || []
  return (Array.isArray(list) ? list : [list]).filter(Boolean).map((e: any, i: number) => ({
    name: e.name || t('portal.b.detail.evidenceItem', { n: i + 1 }),
    text: e.description || e.narrative || '',
    url: safeHttpUrl(e.id || e.url),
  }))
})

// Habilidades: cada etiqueta lleva al resultado que la respalda, si está en la credencial.
const outcomeCodes = computed(() => new Set(info.value.outcomes.map((o: any) => o.targetCode).filter(Boolean)))
const skills = computed(() => info.value.skills.map((s: any) => ({ ...s, anchor: s.result && outcomeCodes.value.has(s.result) ? resultAnchor(s.result) : '' })))

// «Emisor verificado» en lenguaje claro: la firma y la vigencia por separado.
// El servidor no vuelve a revisar la firma de una credencial vencida o revocada.
const issuerName = computed(() => props.credential?.issuer?.name || branding.name)
const domain = computed(() => didWebDomain(props.credential?.issuer))
const didUrl = computed(() => (domain.value && !domain.value.includes('/') ? `https://${domain.value}/.well-known/did.json` : ''))
const firma = computed<'ok' | 'no' | 'sin'>(() => {
  const proof = checks.value.find(c => c.check === 'proof')
  if (proof) {
    return proof.result === 'success' ? 'ok' : proof.result === 'error' ? 'no' : 'sin'
  }
  return props.result?.verified ? 'ok' : 'sin'
})

// Datos para LinkedIn (solo el titular los usa).
const linkedin = computed(() => ({
  name: props.credential?.name || '',
  organization: issuerName.value,
  issued: issued.value,
  expires: expiry.value,
  certId: String(props.credential?.id || props.credentialId),
  url: props.shareableUrl,
}))
const skillNames = computed(() => skills.value.map((s: any) => s.name))

function checkLabel(name: string) {
  const label = t(`portal.b.detail.check.${name}`)
  return label.startsWith('portal.') ? t('portal.b.detail.check.default') : label
}

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(props.shareableUrl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2500)
  }
  catch {
    emit('share')
  }
}
</script>

<template>
  <div class="mc-detalle">
    <section class="mc-detalle__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor">
        <NuxtLink v-if="signedIn" to="/dashboard" class="mc-detalle__volver">
          <span class="i-heroicons-arrow-left" aria-hidden="true" /> {{ t('portal.b.detail.back') }}
        </NuxtLink>
        <div class="mc-detalle__rejilla">
          <div class="mc-detalle__insignia">
            <img v-if="imageUrl" :src="imageUrl" :alt="t('portal.b.detail.badgeAlt', { name: credential.name })" @error="emit('imageError')">
            <span v-else class="mc-detalle__sin-imagen i-heroicons-academic-cap" aria-hidden="true" />
          </div>
          <div class="mc-detalle__titulo">
            <p class="mc-etiqueta">
              {{ kind }}
            </p>
            <h1 class="mc-titulo">
              {{ credential.name }}
            </h1>
            <p v-if="info.holder" class="mc-detalle__titular">
              {{ t('portal.b.detail.awardedTo') }} <b>{{ info.holder }}</b>
            </p>
            <p class="mc-detalle__emisor">
              {{ t('portal.b.detail.issuedBy') }} {{ credential.issuer?.name || branding.name }}<span v-if="info.creator"> › {{ info.creator }}</span>
            </p>
            <div class="mc-detalle__chips">
              <span class="mc-chip" :class="chip[estado]" data-testid="estado-credencial">{{ estadoTexto }}</span>
              <span v-if="result?.verified" class="mc-chip mc-chip--vidrio">{{ t('portal.b.detail.authentic') }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="mc-contenedor mc-detalle__cuerpo">
      <div v-if="estado === 'revocada'" class="mc-detalle__aviso mc-aviso mc-aviso--no" role="status">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-no-symbol" /></span>
        <div>
          <p><b>{{ t('portal.b.detail.revokedTitle') }}</b></p>
          <p>{{ t('portal.b.detail.revokedText') }}</p>
          <p v-if="motivo">
            {{ t('portal.b.detail.revokedReason', { reason: motivo }) }}
          </p>
        </div>
      </div>
      <div v-else-if="estado === 'vencida'" class="mc-detalle__aviso mc-aviso mc-aviso--esp" role="status">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-clock" /></span>
        <div>
          <p><b>{{ t('portal.b.detail.expiredTitle') }}</b></p>
          <p>{{ t('portal.b.detail.expiredText', { date: day(expiry) }) }}</p>
        </div>
      </div>
      <div v-else-if="estado === 'invalida'" class="mc-detalle__aviso mc-aviso mc-aviso--no" role="status">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-exclamation-triangle" /></span>
        <div>
          <p><b>{{ t('portal.b.detail.unverifiedTitle') }}</b></p>
          <p>{{ t('portal.b.detail.unverifiedText') }}</p>
        </div>
      </div>

      <div class="mc-detalle__principal">
        <section class="mc-tarjeta mc-detalle__bloque">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.what') }}
          </h2>
          <p v-if="info.achievement.description" class="mc-detalle__texto">
            {{ info.achievement.description }}
          </p>
          <p v-if="info.event" class="mc-detalle__texto mc-suave">
            {{ info.event }}
          </p>
          <div v-if="skills.length" class="mc-detalle__habilidades" data-testid="habilidades">
            <h3>{{ t('portal.b.detail.skills') }}</h3>
            <ul>
              <li v-for="skill in skills" :key="skill.name">
                <a v-if="skill.anchor" :href="`#${skill.anchor}`" class="mc-detalle__habilidad" :title="skill.support">
                  {{ skill.name }}<span class="i-heroicons-arrow-down-right" aria-hidden="true" /><span class="sr-only">{{ t('portal.b.detail.skillSupport', { code: skill.result }) }}</span>
                </a>
                <span v-else class="mc-detalle__habilidad" :title="skill.support || undefined">{{ skill.name }}</span>
              </li>
            </ul>
            <p class="mc-suave mc-detalle__habilidades-nota">
              {{ t('portal.b.detail.skillsNote') }}
            </p>
          </div>
          <template v-if="info.outcomes.length">
            <h3>{{ t('portal.b.detail.outcomes') }}</h3>
            <ul class="mc-detalle__logros">
              <li v-for="(outcome, i) in info.outcomes" :id="outcome.targetCode ? resultAnchor(outcome.targetCode) : undefined" :key="i">
                <span class="i-heroicons-check-circle" aria-hidden="true" /><span><small v-if="outcome.targetCode" class="mc-detalle__codigo">{{ outcome.targetCode }}</small>{{ outcome.targetName }}</span>
              </li>
            </ul>
          </template>
          <dl v-if="info.levels.length || info.credits !== undefined || info.fieldOfStudy || info.language || info.achievement.humanCode" class="mc-detalle__datos">
            <div v-for="(level, i) in info.levels" :key="`l${i}`">
              <dt>{{ level.targetFramework }}</dt><dd>{{ qualificationLabel(level) }}</dd>
            </div>
            <div v-if="info.credits !== undefined">
              <dt>{{ t('portal.b.detail.credits') }}</dt><dd>{{ info.credits }}</dd>
            </div>
            <div v-if="info.fieldOfStudy">
              <dt>{{ t('portal.b.detail.field') }}</dt><dd>{{ info.fieldOfStudy }}</dd>
            </div>
            <div v-if="info.language">
              <dt>{{ t('portal.b.detail.language') }}</dt><dd>{{ info.language }}</dd>
            </div>
            <div v-if="info.achievement.humanCode">
              <dt>{{ t('portal.b.detail.code') }}</dt><dd>{{ info.achievement.humanCode }}<span v-if="info.achievement.version"> · {{ t('portal.b.detail.version', { version: info.achievement.version }) }}</span></dd>
            </div>
          </dl>
          <ul v-if="info.achievement.tag?.length" class="mc-detalle__etiquetas">
            <li v-for="tag in info.achievement.tag" :key="tag">
              {{ tag }}
            </li>
          </ul>
          <div v-for="(alignment, i) in info.otherAlignments" :key="`a${i}`">
            <h3>{{ alignment.targetFramework || t('portal.b.detail.framework') }}</h3>
            <p>{{ alignment.targetName }}</p>
          </div>
          <a v-if="info.catalog" :href="info.catalog" target="_blank" rel="noopener noreferrer" class="mc-enlace">{{ t('portal.b.detail.catalog') }}</a>
        </section>

        <section v-if="evaluated.length || info.criteria" class="mc-tarjeta mc-detalle__bloque">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.how') }}
          </h2>
          <p v-if="info.criteria" class="mc-detalle__texto">
            {{ info.criteria }}
          </p>
          <ul v-if="evaluated.length" class="mc-detalle__criterios">
            <li v-for="(r, i) in evaluated" :key="i">
              <span>{{ r.name }}</span>
              <b>{{ r.value }}</b>
              <small v-if="r.detail" class="mc-suave">{{ r.detail }}</small>
            </li>
          </ul>
        </section>

        <section v-if="evidence.length" class="mc-tarjeta mc-detalle__bloque">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.evidence') }}
          </h2>
          <ul class="mc-detalle__evidencias">
            <li v-for="(e, i) in evidence" :key="i">
              <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-document-text" /></span>
              <div>
                <b>{{ e.name }}</b>
                <p v-if="e.text" class="mc-suave">
                  {{ e.text }}
                </p>
                <a v-if="e.url" :href="e.url" target="_blank" rel="noopener noreferrer" class="mc-enlace">{{ t('portal.b.detail.evidenceOpen') }}</a>
              </div>
            </li>
          </ul>
        </section>

        <section class="mc-tarjeta mc-detalle__bloque">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.data') }}
          </h2>
          <dl class="mc-detalle__datos">
            <div><dt>{{ t('portal.b.detail.issued') }}</dt><dd>{{ day(issued) || dates.issued }}</dd></div>
            <div v-if="dates.awarded">
              <dt>{{ t('portal.b.detail.awarded') }}</dt><dd>{{ dates.awarded }}</dd>
            </div>
            <div><dt>{{ t('portal.b.detail.expires') }}</dt><dd>{{ expiry ? day(expiry) : t('portal.b.detail.noExpiry') }}</dd></div>
            <div v-if="info.subject.activityStartDate">
              <dt>{{ t('portal.b.detail.activityStart') }}</dt><dd>{{ day(info.subject.activityStartDate) }}</dd>
            </div>
            <div v-if="info.subject.activityEndDate">
              <dt>{{ t('portal.b.detail.activityEnd') }}</dt><dd>{{ day(info.subject.activityEndDate) }}</dd>
            </div>
            <div v-if="info.subject.term">
              <dt>{{ t('portal.b.detail.term') }}</dt><dd>{{ info.subject.term }}</dd>
            </div>
            <div v-if="info.subject.source?.name">
              <dt>{{ t('portal.b.detail.partner') }}</dt><dd>{{ info.subject.source.name }}</dd>
            </div>
          </dl>
        </section>

        <PortalSiguientes v-if="holder" :clave="info.achievement.humanCode" :nombre="credential.name" class="mc-detalle__siguientes" />
      </div>

      <aside class="mc-detalle__lateral" :class="{ 'mc-detalle__lateral--titular': holder }">
        <section class="mc-tarjeta mc-detalle__bloque mc-detalle__verificar">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.verifyTitle') }}
          </h2>
          <div class="mc-emisor" data-testid="emisor-verificado">
            <p class="mc-emisor__titulo">
              <span class="mc-emisor__sello" :class="`mc-emisor__sello--${firma}`" aria-hidden="true"><span :class="firma === 'no' ? 'i-heroicons-shield-exclamation' : 'i-heroicons-check-badge'" /></span>
              <span>
                <small>{{ firma === 'ok' ? t('portal.b.issuer.verified') : t('portal.b.issuer.declared') }}</small>
                <b>{{ issuerName }}</b>
              </span>
            </p>
            <p class="mc-emisor__texto">
              <template v-if="domain">
                {{ t('portal.b.issuer.domainBefore') }} <b>{{ domain }}</b>{{ t('portal.b.issuer.domainAfter') }}
              </template>
              <template v-else>
                {{ t('portal.b.issuer.noDomain') }}
              </template>
            </p>
            <ul class="mc-emisor__estados">
              <li :class="`mc-emisor__estado--${firma}`">
                <span :class="firma === 'ok' ? 'i-heroicons-check-circle' : firma === 'no' ? 'i-heroicons-x-circle' : 'i-heroicons-minus-circle'" aria-hidden="true" />
                <span><b>{{ t('portal.b.issuer.signature') }}</b> {{ t(`portal.b.issuer.signature_${firma}`) }}</span>
              </li>
              <li :class="`mc-emisor__estado--${estado === 'vigente' ? 'ok' : estado === 'vencida' ? 'esp' : 'no'}`">
                <span :class="estado === 'vigente' ? 'i-heroicons-check-circle' : estado === 'vencida' ? 'i-heroicons-clock' : 'i-heroicons-x-circle'" aria-hidden="true" />
                <span><b>{{ t('portal.b.issuer.validity') }}</b> {{ estadoTexto }}</span>
              </li>
            </ul>
            <a v-if="didUrl" :href="didUrl" target="_blank" rel="noopener noreferrer" class="mc-enlace mc-emisor__did">{{ t('portal.b.issuer.didLink') }}</a>
          </div>
          <p class="mc-suave">
            {{ t('portal.b.detail.verifyText') }}
          </p>
          <div class="mc-detalle__qr">
            <img v-if="qr" :src="qr" :alt="t('portal.holder.qrAlt')" width="160" height="160">
          </div>
          <a :href="shareableUrl" class="mc-enlace mc-detalle__url">{{ shareableUrl }}</a>
          <div class="mc-detalle__acciones">
            <button class="mc-boton" type="button" @click="copy">
              <span :class="copied ? 'i-heroicons-check' : 'i-heroicons-link'" aria-hidden="true" />
              {{ copied ? t('portal.b.detail.copied') : t('portal.b.detail.copy') }}
            </button>
            <button class="mc-boton mc-boton--secundario" type="button" @click="emit('share')">
              <span class="i-heroicons-share" aria-hidden="true" /> {{ t('portal.b.detail.share') }}
            </button>
          </div>
          <span class="sr-only" role="status" aria-live="polite">{{ copied ? t('portal.b.detail.copied') : '' }}</span>
          <details class="mc-detalle__comprobaciones">
            <summary>{{ t('portal.b.detail.checks') }}</summary>
            <p class="mc-suave">
              {{ t('portal.b.detail.checksText') }}
            </p>
            <ul>
              <li v-for="c in checks" :key="c.check">
                <span :class="c.result === 'success' ? 'i-heroicons-check-circle mc-ok' : c.result === 'warning' ? 'i-heroicons-exclamation-circle mc-esp' : 'i-heroicons-x-circle mc-no'" aria-hidden="true" />
                {{ checkLabel(c.check) }}: {{ t(`portal.b.detail.result.${c.result}`) }}
              </li>
            </ul>
            <button class="mc-boton mc-boton--texto" type="button" @click="emit('recheck')">
              {{ t('portal.b.detail.recheck') }}
            </button>
          </details>
          <RecipientCheck v-if="!holder" :credential-id="credentialId" class="mc-detalle__destinatario" />
        </section>

        <section v-if="holder" class="mc-tarjeta mc-detalle__bloque mc-detalle__acciones-titular" data-testid="acciones-titular">
          <h2 class="mc-titulo">
            {{ t('portal.b.detail.holderActionsTitle') }}
          </h2>
          <PortalLinkedin v-if="estado === 'vigente'" :credential="linkedin" :skills="skillNames" />
          <HolderWallet :credential-id="credentialId" />
        </section>

        <HolderDownloads v-if="holder" :credential-id="credentialId" :privacy="holder.rawCredential" @saved="emit('privacySaved')" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.mc-detalle { padding-bottom: 1rem; overflow-wrap: anywhere; }
.mc-detalle__cabeza { padding: 1.25rem 0 5rem; }
.mc-detalle__volver { display: inline-flex; align-items: center; gap: .35rem; color: #fff; opacity: .88; font-weight: 600; font-size: var(--mc-t-s); text-decoration: none; margin-bottom: 1rem; }
.mc-detalle__volver:hover { opacity: 1; text-decoration: underline; }
.mc-detalle__rejilla { display: grid; gap: 1.25rem; justify-items: center; text-align: center; }
.mc-detalle__insignia {
  width: 148px; height: 148px; border-radius: 28px; background: #fff; padding: 14px; display: grid; place-items: center;
  box-shadow: 0 0 0 8px rgba(99, 171, 208, .18), var(--mc-sombra-alta);
}
.mc-detalle__insignia img { width: 100%; height: 100%; object-fit: contain; }
.mc-detalle__sin-imagen { font-size: 4.5rem; color: #2a6f97; }
.mc-detalle__titulo { display: grid; gap: .45rem; justify-items: center; min-width: 0; }
.mc-detalle__titulo .mc-etiqueta { opacity: .85; }
.mc-detalle__titulo h1 { font-size: clamp(1.7rem, 6vw, 2.6rem); }
.mc-detalle__titular { font-size: var(--mc-t-l); }
.mc-detalle__emisor { opacity: .88; }
.mc-detalle__chips { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; margin-top: .25rem; }

.mc-detalle__cuerpo { margin-top: -3.25rem; display: grid; gap: 1rem; position: relative; }
/* El titular en celular necesita primero su cartera y sus descargas */
.mc-detalle__lateral--titular { order: -1; }
.mc-detalle__lateral--titular .mc-detalle__verificar { order: 1; }
.mc-detalle__aviso { order: -2; }
.mc-detalle__principal, .mc-detalle__lateral { display: grid; gap: 1rem; align-content: start; min-width: 0; }
.mc-detalle__bloque { padding: 1.25rem; display: grid; gap: .8rem; align-content: start; }
.mc-detalle__bloque h2 { font-size: var(--mc-t-l); }
.mc-detalle__bloque h3 { font-weight: 700; margin-top: .35rem; }
.mc-detalle__texto { white-space: pre-line; line-height: 1.6; }
.mc-detalle__logros { display: grid; gap: .5rem; }
.mc-detalle__logros li { display: flex; gap: .55rem; align-items: flex-start; line-height: 1.45; }
.mc-detalle__logros li > span[aria-hidden] { flex: none; color: var(--mc-ok); font-size: 1.2rem; margin-top: .05rem; }
.mc-detalle__datos { display: grid; gap: .75rem; }
.mc-detalle__datos dt { font-size: var(--mc-t-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--mc-suave); }
.mc-detalle__datos dd { font-weight: 600; }
.mc-detalle__habilidades { display: grid; gap: .55rem; padding: .9rem; border-radius: var(--mc-r); background: var(--mc-hielo); }
.mc-detalle__habilidades h3 { margin-top: 0; }
.mc-detalle__habilidades ul { display: flex; flex-wrap: wrap; gap: .45rem; }
.mc-detalle__habilidad {
  display: inline-flex; align-items: center; gap: .3rem; padding: .35rem .8rem; border-radius: 999px;
  background: var(--mc-superficie); color: var(--mc-enlace); border: 1px solid var(--mc-linea); font-weight: 700; font-size: var(--mc-t-s); text-decoration: none;
}
a.mc-detalle__habilidad:hover { border-color: var(--mc-claro); text-decoration: underline; }
.mc-detalle__habilidad span[aria-hidden] { font-size: .95em; opacity: .75; }
.mc-detalle__habilidades-nota { font-size: var(--mc-t-xs); line-height: 1.45; }
.mc-detalle__codigo { display: inline-block; margin-right: .4rem; font: 700 var(--mc-t-xs) var(--mc-fuente-texto); color: var(--mc-suave); letter-spacing: .04em; }
.mc-detalle__logros li:target { outline: 2px solid var(--mc-claro); outline-offset: 4px; border-radius: 6px; }
.mc-detalle__logros li { scroll-margin-top: 6rem; }
.mc-detalle__siguientes { margin-top: .5rem; }
.mc-detalle__acciones-titular { gap: 1rem; }
.mc-detalle__acciones-titular :deep(.wallet-save) { width: 100%; justify-content: center; }

.mc-emisor { display: grid; gap: .65rem; padding: .9rem; border-radius: var(--mc-r); background: var(--mc-fondo); border: 1px solid var(--mc-linea); }
.mc-emisor__titulo { display: flex; gap: .7rem; align-items: center; }
.mc-emisor__titulo small { display: block; font-size: var(--mc-t-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--mc-suave); }
.mc-emisor__titulo b { display: block; line-height: 1.25; }
.mc-emisor__sello { flex: none; width: 2.5rem; height: 2.5rem; border-radius: 12px; display: grid; place-items: center; font-size: 1.45rem; background: var(--mc-hielo); color: var(--mc-enlace); }
.mc-emisor__sello--ok { background: var(--mc-ok-fondo); color: var(--mc-ok); }
.mc-emisor__sello--no { background: var(--mc-no-fondo); color: var(--mc-no); }
.mc-emisor__texto { font-size: var(--mc-t-s); line-height: 1.5; }
.mc-emisor__estados { display: grid; gap: .4rem; font-size: var(--mc-t-s); }
.mc-emisor__estados li { display: flex; gap: .45rem; align-items: flex-start; line-height: 1.4; }
.mc-emisor__estados li > span:first-child { flex: none; font-size: 1.15rem; margin-top: .05rem; }
.mc-emisor__estado--ok > span:first-child { color: var(--mc-ok); }
.mc-emisor__estado--esp > span:first-child { color: var(--mc-esp); }
.mc-emisor__estado--no > span:first-child { color: var(--mc-no); }
.mc-emisor__estado--sin > span:first-child { color: var(--mc-suave); }
.mc-emisor__did { font-size: var(--mc-t-s); }
.mc-detalle__etiquetas { display: flex; flex-wrap: wrap; gap: .4rem; }
.mc-detalle__etiquetas li { padding: .2rem .65rem; border-radius: 999px; background: var(--mc-hielo); color: var(--mc-enlace); font-size: var(--mc-t-s); font-weight: 600; }
.mc-detalle__criterios { display: grid; gap: .6rem; }
.mc-detalle__criterios li { display: grid; gap: .15rem; padding: .75rem .9rem; border-radius: var(--mc-r-s); background: var(--mc-hielo); }
.mc-detalle__criterios b { color: var(--mc-enlace); }
.mc-detalle__evidencias { display: grid; gap: .85rem; }
.mc-detalle__evidencias li { display: flex; gap: .85rem; align-items: flex-start; }
.mc-detalle__evidencias p { font-size: var(--mc-t-s); margin: .2rem 0 .35rem; }

.mc-detalle__qr { justify-self: center; padding: 10px; background: #fff; border-radius: var(--mc-r); border: 1px solid var(--mc-linea); min-height: 180px; min-width: 180px; display: grid; place-items: center; }
.mc-detalle__url { font-size: var(--mc-t-s); font-weight: 500; }
.mc-detalle__acciones { display: flex; flex-wrap: wrap; gap: .5rem; }
.mc-detalle__acciones .mc-boton { flex: 1 1 9rem; }
.mc-detalle__comprobaciones { border-top: 1px solid var(--mc-linea); padding-top: .75rem; }
.mc-detalle__comprobaciones summary { cursor: pointer; font-weight: 700; }
.mc-detalle__comprobaciones p { font-size: var(--mc-t-s); margin: .5rem 0; }
.mc-detalle__comprobaciones ul { display: grid; gap: .35rem; font-size: var(--mc-t-s); }
.mc-detalle__comprobaciones li { display: flex; align-items: center; gap: .4rem; }
.mc-ok { color: var(--mc-ok); }
.mc-esp { color: var(--mc-esp); }
.mc-no { color: var(--mc-no); }
/* RecipientCheck trae sus propios colores grises de Certo: aquí habla con los tokens */
.mc-detalle__destinatario { margin: 0 !important; padding: .9rem !important; background: var(--mc-fondo) !important; color: var(--mc-texto) !important; border-color: var(--mc-linea) !important; border-radius: var(--mc-r-s) !important; }
.mc-detalle__destinatario :deep(p) { color: var(--mc-suave) !important; }
.mc-detalle__destinatario :deep(p[role='status']) { color: var(--mc-texto) !important; }
.mc-detalle__destinatario :deep(input) { flex: 1 1 100% !important; width: 100%;  background: var(--mc-superficie) !important; color: var(--mc-texto) !important; border-color: var(--mc-linea) !important; min-height: 44px; }
.mc-detalle__destinatario :deep(button) { background: var(--mc-primario) !important; color: var(--mc-primario-texto) !important; font-weight: 700; border-radius: 12px !important; min-height: 44px; }

@media (min-width: 768px) {
  .mc-detalle__cabeza { padding: 1.75rem 0 6rem; }
  .mc-detalle__rejilla { grid-template-columns: auto minmax(0, 1fr); justify-items: start; text-align: left; align-items: center; gap: 2rem; }
  .mc-detalle__insignia { width: 196px; height: 196px; }
  .mc-detalle__titulo { justify-items: start; }
  .mc-detalle__chips { justify-content: flex-start; }
  .mc-detalle__datos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mc-detalle__bloque { padding: 1.5rem; }
}
@media (min-width: 1024px) {
  .mc-detalle__cuerpo { grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 1.25rem; }
  .mc-detalle__aviso { grid-column: 1 / -1; }
  .mc-detalle__lateral--titular { order: 0; }
}
</style>
