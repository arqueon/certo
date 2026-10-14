<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// Vista de avance de las rutas apilables (adenda 0026, 14-oct-2026): «Ruta X:
// 2 de 3», con la insignia de la ruta y los tramos que faltan velados (una
// imagen solo del portal, nunca la emitida) y el paso que falta, con enlace a
// su oferta. El avance se calcula aquí con las credenciales vigentes de la
// persona; a la consola solo se le preguntan las rutas públicas de esas fichas.
// Con `foco` (la clave de la credencial abierta) se muestran solo sus rutas.
const props = defineProps<{ credentials?: any[], foco?: string }>()
const { t } = useI18n()
const propias = ref<any[]>([])
const rutas = ref<any[]>([])
const sinImagen = reactive<Record<string, boolean>>({})

const metadata = (c: any) => c?.achievementMetadata0023 || c?.achievement?.metadata0023 || {}
const claveDe = (c: any) => String(metadata(c).humanCode || '')
function vigente(c: any) {
  if (c?.revoked) {
    return false
  }
  const hasta = c?.expirationDate || c?.validUntil
  return !hasta || Date.parse(hasta) > Date.now()
}
const lista = computed(() => props.credentials ?? propias.value)
const tengo = computed(() => new Set(lista.value.filter(vigente).map(claveDe).filter(Boolean)))
// Una ruta ya recibida (aunque luego venza) no se vuelve a ofrecer como pendiente.
const recibidas = computed(() => new Set(lista.value.map(claveDe).filter(Boolean)))

async function cargar() {
  rutas.value = []
  if (!props.credentials) {
    try {
      const r: any = await apiClient.getReceivedCertificates()
      propias.value = r?.data || []
    }
    catch {
      propias.value = []
    }
  }
  const pasos = [...tengo.value]
  if (!pasos.length) {
    return
  }
  try {
    const r = await $fetch<{ data: any[] }>('/portal/rutas', { query: { pasos: pasos.join(',') } })
    rutas.value = Array.isArray(r?.data) ? r.data : []
  }
  catch {
    rutas.value = []
  }
}
onMounted(cargar)
watch(() => props.credentials?.length, cargar)

const visibles = computed(() => rutas.value
  .filter(r => !props.foco || r.pasos.some((p: any) => p.clave === props.foco))
  .map((r) => {
    const pasos = r.pasos.map((p: any) => ({ ...p, hecho: tengo.value.has(p.clave) }))
    const hechos = pasos.filter((p: any) => p.hecho).length
    return { ...r, pasos, hechos, total: pasos.length, completa: recibidas.value.has(r.clave), lista: hechos === pasos.length }
  })
  .filter(r => r.hechos > 0))
</script>

<template>
  <section v-if="visibles.length" class="mc-rutas" aria-labelledby="mc-rutas-titulo" data-testid="ruta-avance">
    <h2 id="mc-rutas-titulo" class="mc-titulo">
      {{ foco ? t('portal.b.route.titleOne') : t('portal.b.route.title') }}
    </h2>
    <article v-for="r in visibles" :key="r.clave" class="mc-ruta mc-tarjeta" :data-ruta="r.clave">
      <img
        v-if="r.avance && !sinImagen[r.clave]"
        :src="`${r.avance}?hechos=${r.completa ? r.total : r.hechos}`"
        alt=""
        width="96"
        height="96"
        class="mc-ruta__insignia"
        loading="lazy"
        @error="sinImagen[r.clave] = true"
      >
      <div class="mc-ruta__cuerpo">
        <p class="mc-ruta__cabeza">
          <b>{{ r.nombre }}</b>
          <span class="mc-chip" :class="r.completa ? 'mc-chip--ok' : 'mc-chip--esp'">
            {{ r.completa ? t('portal.b.route.done') : t('portal.b.route.progress', { done: r.hechos, total: r.total }) }}
          </span>
        </p>
        <div class="mc-ruta__barra" role="progressbar" :aria-valuenow="r.hechos" aria-valuemin="0" :aria-valuemax="r.total" :aria-label="t('portal.b.route.progress', { done: r.hechos, total: r.total })">
          <span v-for="p in r.pasos" :key="p.clave" :class="{ 'mc-ruta__tramo--hecho': p.hecho }" />
        </div>
        <p v-if="!r.completa && r.lista" class="mc-ruta__nota mc-suave">
          {{ t('portal.b.route.ready') }}
        </p>
        <ol class="mc-ruta__pasos">
          <li v-for="p in r.pasos" :key="p.clave" :class="{ 'mc-ruta__paso--hecho': p.hecho }">
            <span class="mc-ruta__marca" :class="p.hecho ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle'" aria-hidden="true" />
            <span class="mc-ruta__paso-texto">
              <span>{{ p.nombre }}</span>
              <span class="sr-only">{{ p.hecho ? t('portal.b.route.stepDone') : t('portal.b.route.stepMissing') }}</span>
              <a v-if="!p.hecho && (p.inscripcion || p.url)" :href="p.inscripcion || p.url" target="_blank" rel="noopener noreferrer" class="mc-enlace mc-ruta__ir">
                {{ t('portal.b.route.howTo') }}<span class="sr-only"> {{ p.nombre }}</span><span class="sr-only">{{ t('portal.b.linkedin.newTab') }}</span>
              </a>
            </span>
          </li>
        </ol>
        <a v-if="r.url" :href="r.url" target="_blank" rel="noopener noreferrer" class="mc-enlace mc-ruta__ver">
          {{ t('portal.b.route.see') }}<span class="sr-only">{{ t('portal.b.linkedin.newTab') }}</span>
        </a>
      </div>
    </article>
  </section>
</template>

<style scoped>
.mc-rutas { display: grid; gap: .75rem; }
.mc-rutas h2 { font-size: var(--mc-t-l); }
.mc-ruta { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr); gap: .9rem; padding: .9rem; box-shadow: none; align-items: start; }
.mc-ruta__insignia { width: 5.5rem; height: 5.5rem; }
.mc-ruta__cuerpo { display: grid; gap: .55rem; min-width: 0; }
.mc-ruta__cabeza { display: flex; flex-wrap: wrap; gap: .4rem .6rem; align-items: center; justify-content: space-between; }
.mc-ruta__cabeza b { line-height: 1.25; }
.mc-ruta__barra { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: .3rem; }
.mc-ruta__barra span { height: .4rem; border-radius: 999px; background: var(--mc-linea); }
.mc-ruta__barra span.mc-ruta__tramo--hecho { background: var(--mc-ok); }
.mc-ruta__nota { font-size: var(--mc-t-s); }
.mc-ruta__pasos { display: grid; gap: .35rem; }
.mc-ruta__pasos li { display: flex; gap: .45rem; align-items: flex-start; font-size: var(--mc-t-s); color: var(--mc-suave); }
.mc-ruta__pasos li.mc-ruta__paso--hecho { color: var(--mc-texto); }
.mc-ruta__marca { flex: none; width: 1.1rem; height: 1.1rem; margin-top: .1rem; color: var(--mc-suave); }
.mc-ruta__paso--hecho .mc-ruta__marca { color: var(--mc-ok); }
.mc-ruta__paso-texto { display: flex; flex-wrap: wrap; gap: .1rem .5rem; }
.mc-ruta__ir, .mc-ruta__ver { font-weight: 700; font-size: var(--mc-t-s); }
</style>
