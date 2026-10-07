<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// "Mis carteras": the wallets this holder added. No DIDs: a kind, dates and
// how many credentials each holds. Removing one stops new copies only.
interface Wallet { id: number; kind: 'account' | 'device'; addedAt: string; credentials: number; lastSavedAt: string | null }
const { t, locale } = useI18n()
const wallets = ref<Wallet[] | null>(null)
const failed = ref(false)
const confirming = ref<number | null>(null)
const removing = ref(false)
const date = (value: string) => new Date(value).toLocaleDateString(locale.value, { dateStyle: 'long' })
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
  <section class="holder-wallets mb-6 rounded-lg border border-gray-300 bg-white p-4 space-y-3" data-testid="holder-wallets" :aria-label="t('portal.wallet.walletsTitle')">
    <h2 class="text-xl font-semibold">{{ t('portal.wallet.walletsTitle') }}</h2>
    <p class="text-sm">{{ t('portal.wallet.walletsHelp') }}</p>
    <p v-if="failed" role="alert">{{ t('portal.wallet.walletsError') }}</p>
    <p v-else-if="wallets && !wallets.length">{{ t('portal.wallet.walletsEmpty') }}</p>
    <ul v-else-if="wallets" class="space-y-3">
      <li v-for="wallet in wallets" :key="wallet.id" class="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{{ t(wallet.kind === 'account' ? 'portal.wallet.walletAccount' : 'portal.wallet.walletDevice') }}</strong>
          · {{ t('portal.wallet.walletAdded', { date: date(wallet.addedAt) }) }}
          · {{ wallet.credentials === 1 ? t('portal.wallet.walletCredentialsOne') : t('portal.wallet.walletCredentials', { count: wallet.credentials }) }}
        </span>
        <span v-if="confirming === wallet.id" class="flex flex-wrap items-center gap-2">
          <span class="text-sm">{{ t('portal.wallet.walletRemoveConfirm') }}</span>
          <button class="brand-button" :disabled="removing" @click="remove(wallet.id)">{{ t('portal.wallet.walletRemove') }}</button>
          <button class="underline" :disabled="removing" @click="confirming = null">{{ t('common.cancel') }}</button>
        </span>
        <button v-else class="underline wallet-remove" @click="confirming = wallet.id">{{ t('portal.wallet.walletRemove') }}</button>
      </li>
    </ul>
  </section>
</template>
