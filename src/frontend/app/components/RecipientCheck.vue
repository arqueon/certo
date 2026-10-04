<script setup lang="ts">
import { apiClient } from '~/api/api-client'

const props = defineProps<{ credentialId: string }>()
const { t } = useI18n()
const inputId = useId()
const email = ref('')
const busy = ref(false)
const outcome = ref('')
let revision = 0
watch([email, () => props.credentialId], () => { outcome.value = ''; revision++ })

async function check() {
  const current = revision
  busy.value = true
  outcome.value = ''
  try {
    const result = await apiClient.checkRecipient(props.credentialId, email.value)
    if (current === revision) outcome.value = result.matches ? 'matches' : 'noMatch'
  }
  catch {
    if (current === revision) outcome.value = 'unavailable'
  }
  finally { busy.value = false }
}
</script>

<template>
  <form class="my-6 rounded-xl border border-gray-200 bg-white p-5 text-gray-800" @submit.prevent="check">
    <label :for="inputId" class="block font-medium">{{ t('recipientCheck.label') }}</label>
    <p class="mt-1 text-sm text-gray-600">{{ t('recipientCheck.help') }}</p>
    <div class="mt-3 flex flex-wrap gap-3">
      <input :id="inputId" v-model="email" type="email" required maxlength="320" autocomplete="off"
        autocapitalize="none" :spellcheck="false" class="min-w-0 flex-1 rounded-lg border border-gray-400 bg-white px-3 py-2 text-gray-900">
      <button type="submit" :disabled="busy" class="rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {{ t(busy ? 'recipientCheck.checking' : 'recipientCheck.submit') }}
      </button>
    </div>
    <p role="status" aria-live="polite" class="mt-3 text-sm">{{ outcome ? t(`recipientCheck.${outcome}`) : '' }}</p>
  </form>
</template>
