<script setup lang="ts">
// «Mis carteras» como pestaña propia del titular (dirección B).
definePageMeta({ middleware: ['auth'], temaB: true })
const { t } = useI18n()
const branding = useBranding()
useHead({ title: () => t('portal.wallet.walletsTitle') })
if (!branding.active) { await navigateTo('/dashboard') }
</script>

<template>
  <div class="mc-carteras">
    <section class="mc-carteras__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor">
        <h1 class="mc-titulo">
          {{ t('portal.wallet.walletsTitle') }}
        </h1>
        <p>{{ t('portal.wallet.walletsHelp') }}</p>
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
