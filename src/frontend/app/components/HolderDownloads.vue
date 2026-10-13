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
  <!-- Solo con marca: holderData existe únicamente para el titular en el portal con marca. -->
  <section class="mc-tarjeta mc-descargas">
    <h2 class="mc-titulo">
      {{ t('portal.b.detail.keepTitle') }}
    </h2>
    <div v-if="credentialId" class="mc-descargas__opcion">
      <NuxtLink :to="`/credentials/${encodeURIComponent(credentialId)}/imprimir`" class="mc-boton">
        <span class="i-heroicons-document-arrow-down" aria-hidden="true" /> {{ t('portal.holder.pdf') }}
      </NuxtLink>
      <p class="mc-suave">
        {{ t('portal.holder.pdfHelp') }}
      </p>
    </div>
    <div v-if="credentialId" class="mc-descargas__opcion">
      <button class="mc-boton mc-boton--secundario" :disabled="busy" @click="exportFile">
        <span class="i-heroicons-code-bracket" aria-hidden="true" /> {{ t('portal.holder.file') }}
      </button>
      <p class="mc-suave">
        {{ t('portal.holder.fileHelp') }}
      </p>
    </div>
    <div class="mc-descargas__opcion">
      <slot />
    </div>
    <details class="mc-descargas__mas">
      <summary>{{ t('portal.holder.clr') }}</summary>
      <p class="mc-suave">
        {{ t('portal.holder.clrHelp') }}
      </p>
      <button class="mc-boton mc-boton--secundario" :disabled="busy" @click="exportHistory">
        {{ t('portal.holder.clr') }}
      </button>
    </details>
    <form v-if="credentialId && privacy" class="mc-descargas__privacidad" @submit.prevent="savePrivacy">
      <fieldset :disabled="busy">
        <legend class="mc-titulo">
          {{ t('portal.b.detail.privacyTitle') }}
        </legend>
        <p class="mc-suave">
          {{ t('portal.holder.privacyHelp') }}
        </p>
        <label><input v-model="showName" type="checkbox"> {{ t('portal.holder.showName') }}</label>
        <label><input v-model="publicLink" type="checkbox"> {{ t('portal.holder.publicLink') }}</label>
        <button type="submit" class="mc-boton mc-boton--secundario">
          {{ t('portal.holder.save') }}
        </button>
      </fieldset>
    </form>
    <p v-if="message" :role="failed ? 'alert' : 'status'" class="mc-descargas__mensaje" :class="{ 'mc-descargas__mensaje--no': failed }">
      {{ message }}
    </p>
  </section>
</template>

<style scoped>
.mc-descargas { padding: 1.25rem; display: grid; gap: 1rem; align-content: start; }
.mc-descargas h2 { font-size: var(--mc-t-l); }
.mc-descargas__opcion { display: grid; gap: .4rem; }
.mc-descargas__opcion .mc-boton { justify-self: stretch; }
.mc-descargas__opcion p { font-size: var(--mc-t-s); line-height: 1.45; }
.mc-descargas__mas, .mc-descargas__privacidad { border-top: 1px solid var(--mc-linea); padding-top: .9rem; }
.mc-descargas__mas summary { cursor: pointer; font-weight: 700; }
.mc-descargas__mas p { font-size: var(--mc-t-s); margin: .5rem 0; }
.mc-descargas__privacidad fieldset { display: grid; gap: .6rem; }
.mc-descargas__privacidad legend { font-size: var(--mc-t-base); margin-bottom: .4rem; }
.mc-descargas__privacidad p { font-size: var(--mc-t-s); line-height: 1.45; }
.mc-descargas__privacidad label { display: flex; gap: .55rem; align-items: flex-start; }
.mc-descargas__privacidad input { width: 1.1rem; height: 1.1rem; margin-top: .15rem; accent-color: var(--mc-oceano); flex: none; }
.mc-descargas__privacidad .mc-boton { justify-self: start; }
.mc-descargas__mensaje { font-size: var(--mc-t-s); font-weight: 600; color: var(--mc-ok); }
.mc-descargas__mensaje--no { color: var(--mc-no); }
@media (min-width: 1024px) { .mc-descargas { padding: 1.5rem; } }
</style>
