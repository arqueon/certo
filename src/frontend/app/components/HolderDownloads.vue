<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { downloadJson } from '~/utils/download'
const props = defineProps<{ credentialId?: string; privacy?: { publicRecipientName?: boolean; publicLinkActive?: boolean } }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const showName = ref(props.privacy?.publicRecipientName !== false)
const publicLink = ref(props.privacy?.publicLinkActive !== false)
const busy = ref(false)
const message = ref('')
const failed = ref(false)
async function run(action: () => Promise<void>) {
  busy.value = true; message.value = ''; failed.value = false
  try { await action() }
  catch { message.value = t('portal.holder.error'); failed.value = true }
  finally { busy.value = false }
}
function exportFile() {
  return run(async () => {
    const response = await apiClient.exportCertificate(props.credentialId!)
    downloadJson(response.data, `credential-${props.credentialId!.replaceAll(':', '-')}.json`)
  })
}
function exportHistory() {
  return run(async () => {
    const response = await apiClient.get<{ data: any[] }>('/api/holder/clrs')
    if (!response.data.length) { message.value = t('portal.holder.noClr'); return }
    // Each CLR remains a standalone signed document, importable by a wallet.
    response.data.forEach((record, index) => downloadJson(record, `history-${index + 1}.json`))
  })
}
function savePrivacy() {
  return run(async () => {
    await apiClient.put(`/api/credentials/${encodeURIComponent(props.credentialId!)}/privacy`, {
      data: { publicRecipientName: showName.value, publicLinkActive: publicLink.value },
    })
    message.value = t('portal.holder.saved'); emit('saved')
  })
}
</script>

<template>
  <section class="portal-card my-6 space-y-5">
    <h2>{{ t('portal.holder.title') }}</h2>
    <div v-if="credentialId">
      <NuxtLink :to="`/credentials/${encodeURIComponent(credentialId)}/imprimir`" class="brand-button">{{ t('portal.holder.pdf') }}</NuxtLink>
      <p>{{ t('portal.holder.pdfHelp') }}</p>
      <button class="brand-button" :disabled="busy" @click="exportFile">{{ t('portal.holder.file') }}</button>
      <p>{{ t('portal.holder.fileHelp') }}</p>
    </div>
    <div>
      <button class="brand-button" :disabled="busy" @click="exportHistory">{{ t('portal.holder.clr') }}</button>
      <p>{{ t('portal.holder.clrHelp') }}</p>
    </div>
    <div>
      <h3 class="text-xl font-semibold">{{ t('portal.holder.wallet') }}</h3>
      <p>{{ t('portal.holder.walletHelp') }}</p>
    </div>
    <form v-if="credentialId && privacy" class="space-y-4" @submit.prevent="savePrivacy">
      <fieldset :disabled="busy" class="space-y-4">
        <legend class="text-xl font-semibold">{{ t('portal.holder.privacy') }}</legend>
        <p>{{ t('portal.holder.privacyHelp') }}</p>
        <label class="block"><input v-model="showName" type="checkbox"> {{ t('portal.holder.showName') }}</label>
        <label class="block"><input v-model="publicLink" type="checkbox"> {{ t('portal.holder.publicLink') }}</label>
        <button type="submit" class="brand-button">{{ t('portal.holder.save') }}</button>
      </fieldset>
    </form>
    <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
  </section>
</template>
