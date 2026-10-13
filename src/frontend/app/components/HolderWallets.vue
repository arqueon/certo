<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// "Mis carteras": the wallets this holder added. No DIDs: web or app (and the
// web wallet's name), dates and how many credentials each holds. Removing one
// stops new copies only.
interface Wallet { id: number, kind: 'account' | 'device', client: 'web' | 'app' | null, name: string | null, addedAt: string, credentials: number, lastSavedAt: string | null }
// Con marca: tarjeta por cartera (diseño B). La página /carteras pone el título.
const props = defineProps<{ embedded?: boolean }>()
const { t, locale } = useI18n()
const wallets = ref<Wallet[] | null>(null)
const failed = ref(false)
const confirming = ref<number | null>(null)
const removing = ref(false)
// Date and time: two wallets added the same day must still look different.
const date = (value: string) => new Date(value).toLocaleString(locale.value, { dateStyle: 'long', timeStyle: 'short' })
function icon(wallet: Wallet) {
  return wallet.client === 'app' ? 'i-heroicons-device-phone-mobile' : wallet.client === 'web' ? 'i-heroicons-globe-alt' : 'i-heroicons-question-mark-circle'
}
function label(wallet: Wallet) {
  if (wallet.client === 'web') { return wallet.name ? t('portal.wallet.walletWebNamed', { name: wallet.name }) : t('portal.wallet.walletWeb') }
  if (wallet.client === 'app') { return t('portal.wallet.walletApp') }
  return t('portal.wallet.walletUnknown')
}
async function load() {
  failed.value = false
  try { wallets.value = (await apiClient.get<{ data: Wallet[] }>('/api/holder/wallets')).data }
  catch { failed.value = true }
}
async function remove(id: number) {
  removing.value = true
  try { await apiClient.delete(`/api/holder/wallets/${id}`); confirming.value = null; await load() }
  catch { failed.value = true }
  finally { removing.value = false }
}
onMounted(load)
</script>

<template>
  <section class="holder-wallets" :class="{ 'hws--suelta': !props.embedded }" data-testid="holder-wallets" :aria-label="t('portal.wallet.walletsTitle')">
    <template v-if="!props.embedded">
      <h2 class="mc-titulo">
        {{ t('portal.wallet.walletsTitle') }}
      </h2>
      <p class="mc-suave">
        {{ t('portal.wallet.walletsHelp') }}
      </p>
    </template>
    <p v-if="failed" role="alert" class="mc-aviso mc-aviso--no">
      {{ t('portal.wallet.walletsError') }}
    </p>
    <div v-else-if="wallets && !wallets.length" class="hws-vacio mc-tarjeta">
      <span class="mc-mosaico hws-vacio__icono" aria-hidden="true"><span class="i-heroicons-wallet" /></span>
      <p>{{ t('portal.wallet.walletsEmpty') }}</p>
    </div>
    <ul v-else-if="wallets" class="hws-lista">
      <li v-for="wallet in wallets" :key="wallet.id" class="hws-cartera mc-tarjeta">
        <span class="mc-mosaico hws-cartera__icono" aria-hidden="true"><span :class="icon(wallet)" /></span>
        <div class="hws-cartera__datos">
          <p class="hws-cartera__nombre">
            <strong>{{ label(wallet) }}</strong>
            <span v-if="wallet.kind === 'account'" class="mc-suave"> {{ t('portal.wallet.walletAccountSuffix') }}</span>
          </p>
          <p class="hws-cartera__meta">
            <span class="mc-chip mc-chip--ok">{{ wallet.credentials === 1 ? t('portal.wallet.walletCredentialsOne') : t('portal.wallet.walletCredentials', { count: wallet.credentials }) }}</span>
            <span class="mc-suave">{{ t('portal.wallet.walletAdded', { date: date(wallet.addedAt) }) }}</span>
          </p>
          <div v-if="confirming === wallet.id" class="mc-aviso mc-aviso--no hws-confirmar" role="alertdialog" :aria-label="t('portal.wallet.walletRemove')">
            <p>{{ t('portal.wallet.walletRemoveConfirm') }}</p>
            <div class="hws-confirmar__botones">
              <button class="mc-boton mc-boton--peligro wallet-remove-confirm" :disabled="removing" @click="remove(wallet.id)">
                {{ t('portal.wallet.walletRemove') }}
              </button>
              <button class="mc-boton mc-boton--secundario" :disabled="removing" @click="confirming = null">
                {{ t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>
        <button v-if="confirming !== wallet.id" class="mc-boton mc-boton--texto wallet-remove" @click="confirming = wallet.id">
          {{ t('portal.wallet.walletRemove') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.holder-wallets { display: grid; gap: .85rem; }
.hws--suelta { margin-bottom: 1.5rem; }
.hws--suelta h2 { font-size: var(--mc-t-xl); }
.hws-lista { display: grid; gap: .75rem; }
.hws-cartera { display: flex; align-items: flex-start; gap: .9rem; padding: 1rem; box-shadow: none; }
.hws-cartera__icono { width: 3rem; height: 3rem; border-radius: 14px; font-size: 1.5rem; }
.hws-cartera__datos { flex: 1; min-width: 0; display: grid; gap: .4rem; }
.hws-cartera__nombre strong { font-family: var(--mc-fuente-titulos); font-size: var(--mc-t-l); }
.hws-cartera__meta { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .75rem; font-size: var(--mc-t-s); }
.wallet-remove { flex: none; font-size: var(--mc-t-s); color: var(--mc-suave); }
.wallet-remove:hover { color: var(--mc-no) !important; }
.hws-confirmar { display: grid; gap: .6rem; margin-top: .4rem; }
.hws-confirmar__botones { display: flex; flex-wrap: wrap; gap: .5rem; }
.hws-vacio { display: grid; justify-items: center; gap: .6rem; text-align: center; padding: 2rem 1.25rem; box-shadow: none; }
.hws-vacio__icono { width: 4rem; height: 4rem; font-size: 2.25rem; border-radius: 18px; }
</style>
