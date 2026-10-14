<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { apiClient } from '~/api/api-client'

// «Mis carteras» como pestaña propia del titular (dirección B).
definePageMeta({ middleware: ['auth'], temaB: true })
const { t } = useI18n()
const branding = useBranding()
useHead({ title: () => t('portal.wallet.walletsTitle') })
if (!branding.active) { await navigateTo('/dashboard') }
// «Agregar una cartera» necesita una credencial vigente que viaje a la cartera
// nueva: se usa la más reciente que se pueda guardar.
const mounted = useMounted()
const paraAgregar = ref<string | null>(null)
onMounted(async () => {
  try {
    const respuesta = await apiClient.getReceivedCertificates()
    const vigentes = (respuesta.data || []).filter((c: any) => !c.revoked && (!c.expirationDate || Date.parse(c.expirationDate) > Date.now()))
    vigentes.sort((a: any, b: any) => Date.parse(b.issuanceDate || 0) - Date.parse(a.issuanceDate || 0))
    const primera = vigentes[0]
    paraAgregar.value = primera ? String(primera.credentialId || primera.id) : null
  }
  catch { paraAgregar.value = null }
})
</script>

<template>
  <div class="mc-carteras">
    <section class="mc-carteras__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor">
        <h1 class="mc-titulo">
          {{ t('portal.wallet.walletsTitle') }}
        </h1>
        <p>{{ t('portal.wallet.walletsHelp') }}</p>
        <HolderWallet v-if="mounted && paraAgregar" :credential-id="paraAgregar" agregar class="mc-carteras__agregar" />
      </div>
    </section>
    <div class="mc-contenedor mc-carteras__cuerpo">
      <HolderWallets embedded />
      <aside class="mc-carteras__como mc-tarjeta">
        <h2 class="mc-titulo">
          {{ t('portal.b.wallets.howTitle') }}
        </h2>
        <ol>
          <li><span>1</span>{{ t('portal.b.wallets.how1') }}</li>
          <li><span>2</span>{{ t('portal.b.wallets.how2') }}</li>
          <li><span>3</span>{{ t('portal.b.wallets.how3') }}</li>
        </ol>
        <p class="mc-suave">
          {{ t('portal.wallet.sharedRevocation') }}
        </p>
        <NuxtLink to="/dashboard" class="mc-boton mc-boton--secundario">
          {{ t('portal.b.wallets.goCredentials') }}
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.mc-carteras__cabeza { padding: 1.75rem 0 4.5rem; }
.mc-carteras__cabeza h1 { font-size: var(--mc-t-2xl); }
.mc-carteras__agregar { margin-top: 1rem; }
.mc-carteras__agregar :deep(.wallet-add-page) { background: #fff; color: var(--mc-navy); }
.mc-carteras__cabeza p { margin-top: .35rem; opacity: .88; max-width: 40rem; }
.mc-carteras__cuerpo { margin-top: -3rem; display: grid; gap: 1.25rem; align-items: start; }
.mc-carteras__como { padding: 1.25rem; display: grid; gap: .85rem; box-shadow: none; }
.mc-carteras__como h2 { font-size: var(--mc-t-l); }
.mc-carteras__como ol { display: grid; gap: .6rem; }
.mc-carteras__como li { display: flex; gap: .65rem; align-items: flex-start; }
.mc-carteras__como li span { flex: none; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--mc-hielo); color: var(--mc-enlace); font: 800 var(--mc-t-s) var(--mc-fuente-titulos); }
.mc-carteras__como p { font-size: var(--mc-t-s); }
@media (min-width: 768px) {
  .mc-carteras__cabeza { padding: 2.5rem 0 5.5rem; }
  .mc-carteras__cabeza h1 { font-size: var(--mc-t-3xl); }
  .mc-carteras__cuerpo { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
}
</style>
