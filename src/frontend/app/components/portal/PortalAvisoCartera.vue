<script setup lang="ts">
// Aviso global bajo el encabezado: una cartera nueva espera «Sí, es mía».
// Aparece en cualquier página del portal, sin recargar (useCarteraPendiente).
const { t } = useI18n()
const { pendientes, decidiendo, resultado, fallo, decidir } = useCarteraPendiente()
const actual = computed(() => pendientes.value[0] || null)
const etiqueta = computed(() => {
  const cartera = actual.value
  if (!cartera) { return '' }
  if (cartera.client === 'web') { return cartera.name ? t('portal.wallet.walletWebNamed', { name: cartera.name }) : t('portal.wallet.walletWeb') }
  return cartera.client === 'app' ? t('portal.wallet.walletApp') : t('portal.wallet.walletUnknownShort')
})
// El mensaje de resultado se queda unos segundos y se va solo.
const visibleResultado = ref(false)
let reloj: ReturnType<typeof setTimeout> | undefined
watch(resultado, (valor) => {
  if (reloj) { clearTimeout(reloj) }
  visibleResultado.value = !!valor
  if (valor) { reloj = setTimeout(() => { visibleResultado.value = false }, 8000) }
})
onBeforeUnmount(() => { if (reloj) { clearTimeout(reloj) } })
</script>

<template>
  <div v-if="actual" class="mc-aviso-cartera" role="alert" data-testid="aviso-cartera">
    <div class="mc-contenedor mc-aviso-cartera__fila">
      <span class="mc-aviso-cartera__icono" aria-hidden="true"><span class="i-heroicons-wallet" /></span>
      <div class="mc-aviso-cartera__texto">
        <p class="mc-aviso-cartera__titulo">
          {{ t('portal.b.walletNotice.title') }}
        </p>
        <p>
          {{ actual.credentialName ? t('portal.b.walletNotice.which', { wallet: etiqueta, credential: actual.credentialName }) : t('portal.b.walletNotice.whichNoName', { wallet: etiqueta }) }}
        </p>
        <p v-if="fallo" class="mc-aviso-cartera__fallo">
          {{ t('portal.wallet.error') }}
        </p>
      </div>
      <div class="mc-aviso-cartera__botones">
        <button class="mc-boton aviso-approve" :disabled="decidiendo" @click="decidir(actual.offerId, true)">
          {{ t('portal.wallet.pendingApprove') }}
        </button>
        <button class="mc-boton mc-boton--secundario aviso-refuse" :disabled="decidiendo" @click="decidir(actual.offerId, false)">
          {{ t('portal.b.walletNotice.refuse') }}
        </button>
      </div>
    </div>
  </div>
  <div v-else-if="visibleResultado && resultado" class="mc-aviso-cartera mc-aviso-cartera--hecho" role="status">
    <div class="mc-contenedor mc-aviso-cartera__fila">
      <span class="mc-aviso-cartera__icono" aria-hidden="true"><span :class="resultado === 'approved' ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" /></span>
      <p class="mc-aviso-cartera__texto">
        {{ t(resultado === 'approved' ? 'portal.wallet.pendingApproved' : 'portal.wallet.pendingRefused') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.mc-aviso-cartera { position: sticky; top: 64px; z-index: 45; background: var(--mc-esp-fondo); color: var(--mc-texto); border-bottom: 2px solid var(--mc-esp); box-shadow: 0 10px 24px -18px rgba(10, 14, 30, .6); }
.mc-aviso-cartera--hecho { background: var(--mc-ok-fondo); border-bottom-color: var(--mc-ok); }
.mc-aviso-cartera__fila { display: grid; grid-template-columns: auto 1fr; gap: .5rem .85rem; align-items: center; padding-block: .85rem; }
.mc-aviso-cartera__icono { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 12px; background: var(--mc-superficie); color: var(--mc-esp); font-size: 1.35rem; }
.mc-aviso-cartera--hecho .mc-aviso-cartera__icono { color: var(--mc-ok); }
.mc-aviso-cartera__texto { display: grid; gap: .15rem; font-size: var(--mc-t-s); line-height: 1.45; }
.mc-aviso-cartera__titulo { font: 800 var(--mc-t-base) var(--mc-fuente-titulos); }
.mc-aviso-cartera__fallo { color: var(--mc-no); font-weight: 700; }
.mc-aviso-cartera__botones { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .5rem; }
.mc-aviso-cartera__botones .mc-boton { flex: 1 1 10rem; }
@media (min-width: 768px) {
  .mc-aviso-cartera__fila { grid-template-columns: auto 1fr auto; }
  .mc-aviso-cartera__botones { grid-column: auto; }
  .mc-aviso-cartera__botones .mc-boton { flex: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .mc-aviso-cartera:not(.mc-aviso-cartera--hecho) .mc-aviso-cartera__icono { animation: mc-aviso-pulso 2s ease-in-out 3; }
  @keyframes mc-aviso-pulso { 50% { transform: scale(1.08); } }
}
</style>
