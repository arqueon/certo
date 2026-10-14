<script setup lang="ts">
import type { LinkedinCredential } from '~/utils/linkedin'
import { linkedinAddUrl, linkedinPostText } from '~/utils/linkedin'

// Acción principal del titular junto a «Guardar en mi cartera»: agregar la
// credencial a LinkedIn con los campos ya llenos y copiar un texto sugerido
// para publicarla. `claro` la pinta sobre el degradado del pase de la portada.
const props = defineProps<{ credential: LinkedinCredential, skills?: string[], claro?: boolean }>()
const { t } = useI18n()
const url = computed(() => linkedinAddUrl(props.credential))
const text = computed(() => linkedinPostText({ ...props.credential, skills: props.skills }, t))
const copied = ref(false)
const failed = ref(false)
async function copy() {
  failed.value = false
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2500)
  }
  catch {
    failed.value = true
  }
}
</script>

<template>
  <div class="mc-linkedin" :class="{ 'mc-linkedin--claro': claro }" data-testid="linkedin">
    <a :href="url" target="_blank" rel="noopener noreferrer" class="mc-boton mc-linkedin__agregar" :class="claro ? 'mc-boton--claro' : ''">
      <span class="mc-linkedin__logo" aria-hidden="true">in</span>
      {{ t('portal.b.linkedin.add') }}
      <span class="sr-only">{{ t('portal.b.linkedin.newTab') }}</span>
    </a>
    <details class="mc-linkedin__texto">
      <summary>{{ t('portal.b.linkedin.postTitle') }}</summary>
      <p class="mc-linkedin__ayuda">
        {{ t('portal.b.linkedin.postHelp') }}
      </p>
      <pre class="mc-linkedin__borrador">{{ text }}</pre>
      <button type="button" class="mc-boton mc-boton--secundario mc-linkedin__copiar" @click="copy">
        <span :class="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" aria-hidden="true" />
        {{ copied ? t('portal.b.linkedin.copied') : t('portal.b.linkedin.copy') }}
      </button>
      <p v-if="failed" class="mc-linkedin__error" role="alert">
        {{ t('portal.b.linkedin.copyFailed') }}
      </p>
      <span class="sr-only" role="status" aria-live="polite">{{ copied ? t('portal.b.linkedin.copied') : '' }}</span>
    </details>
  </div>
</template>

<style scoped>
.mc-linkedin { display: grid; gap: .6rem; }
.mc-linkedin__agregar { justify-self: stretch; }
.mc-linkedin__logo {
  display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 5px;
  background: #0a66c2; color: #fff; font: 800 .8rem/1 var(--mc-fuente-texto); letter-spacing: -.02em;
}
.mc-linkedin__texto summary { cursor: pointer; font-weight: 700; font-size: var(--mc-t-s); color: var(--mc-enlace); }
.mc-linkedin--claro .mc-linkedin__texto summary { color: #fff; }
.mc-linkedin__ayuda { font-size: var(--mc-t-s); color: var(--mc-suave); margin: .5rem 0; line-height: 1.45; }
.mc-linkedin--claro .mc-linkedin__ayuda { color: #fff; opacity: .9; }
.mc-linkedin__borrador {
  white-space: pre-wrap; overflow-wrap: anywhere; font: 500 var(--mc-t-s)/1.55 var(--mc-fuente-texto);
  background: var(--mc-fondo); color: var(--mc-texto); border: 1px solid var(--mc-linea); border-radius: var(--mc-r-s); padding: .8rem .9rem; margin: 0 0 .6rem;
}
.mc-linkedin__copiar { width: 100%; }
.mc-linkedin__error { font-size: var(--mc-t-s); color: var(--mc-no); margin-top: .4rem; }
.mc-linkedin--claro .mc-linkedin__error { color: #fff; font-weight: 700; }
</style>
