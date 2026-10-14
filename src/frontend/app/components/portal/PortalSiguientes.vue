<script setup lang="ts">
// «Para seguir aprendiendo» (ideas de POK, VoBo de Rubén del 13-oct-2026): de
// 1 a 3 ofertas de UDGPlus relacionadas con una credencial, cada una con el
// motivo («Comparte la habilidad…») y su página de inscripción. Se pide en el
// cliente, después de montar; si no hay relación o algo falla, no se muestra.
const props = defineProps<{ clave?: string, nombre?: string, titulo?: string }>()
const { t } = useI18n()
const ofertas = ref<any[]>([])
const sinImagen = reactive<Record<string, boolean>>({})

async function cargar() {
  ofertas.value = []
  if (!props.clave && !props.nombre) {
    return
  }
  try {
    const r = await $fetch<{ data: any[] }>('/api/oferta-relacionada', { query: { ...(props.clave ? { clave: props.clave } : {}), ...(props.nombre ? { nombre: props.nombre } : {}) } })
    ofertas.value = Array.isArray(r?.data) ? r.data : []
  }
  catch {
    ofertas.value = []
  }
}
onMounted(cargar)
watch(() => [props.clave, props.nombre], cargar)

function motivo(o: any) {
  const valor = o.motivo?.valor
  if (!valor) {
    return ''
  }
  const clave = `portal.b.next.because.${o.motivo.tipo}`
  const texto = t(clave, { value: valor })
  return texto === clave ? '' : texto
}
function datos(o: any) {
  return [o.tipo, o.horas ? t('portal.b.next.hours', { hours: o.horas }) : '', o.modalidad].filter(Boolean).join(' · ')
}
</script>

<template>
  <section v-if="ofertas.length" class="mc-siguientes" aria-labelledby="mc-siguientes-titulo" data-testid="seguir-aprendiendo">
    <h2 id="mc-siguientes-titulo" class="mc-titulo">
      {{ titulo || t('portal.b.next.title') }}
    </h2>
    <p class="mc-siguientes__intro mc-suave">
      {{ t('portal.b.next.intro') }}
    </p>
    <ul class="mc-siguientes__lista">
      <li v-for="o in ofertas" :key="o.clave">
        <a :href="o.inscripcion" target="_blank" rel="noopener noreferrer" class="mc-siguientes__tarjeta mc-tarjeta">
          <img v-if="o.imagen && !sinImagen[o.clave]" :src="o.imagen" alt="" loading="lazy" class="mc-siguientes__imagen" @error="sinImagen[o.clave] = true">
          <span v-else class="mc-siguientes__imagen mc-siguientes__imagen--vacia mc-degradado" aria-hidden="true"><span class="i-heroicons-academic-cap" /></span>
          <span class="mc-siguientes__texto">
            <small v-if="datos(o)" class="mc-siguientes__datos">{{ datos(o) }}</small>
            <b>{{ o.nombre }}</b>
            <small v-if="motivo(o)" class="mc-siguientes__motivo"><span class="i-heroicons-sparkles" aria-hidden="true" /> {{ motivo(o) }}</small>
            <span class="mc-siguientes__ir">{{ t('portal.b.next.go') }} <span class="i-heroicons-arrow-top-right-on-square" aria-hidden="true" /><span class="sr-only">{{ t('portal.b.linkedin.newTab') }}</span></span>
          </span>
        </a>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.mc-siguientes { display: grid; gap: .75rem; }
.mc-siguientes h2 { font-size: var(--mc-t-l); }
.mc-siguientes__intro { font-size: var(--mc-t-s); margin-top: -.35rem; }
.mc-siguientes__lista { display: grid; gap: .75rem; }
.mc-siguientes__tarjeta { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: .9rem; padding: .7rem; color: var(--mc-texto); text-decoration: none; box-shadow: none; transition: border-color .15s ease; align-items: center; }
.mc-siguientes__tarjeta:hover { border-color: var(--mc-claro); }
.mc-siguientes__tarjeta:hover .mc-siguientes__ir { text-decoration: underline; }
.mc-siguientes__imagen { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--mc-r-s); background: #1a203b; }
.mc-siguientes__imagen--vacia { display: grid; place-items: center; color: #fff; font-size: 1.8rem; }
.mc-siguientes__texto { display: grid; gap: .25rem; min-width: 0; }
.mc-siguientes__texto b { line-height: 1.25; }
.mc-siguientes__datos { color: var(--mc-suave); font-size: var(--mc-t-xs); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.mc-siguientes__motivo { color: var(--mc-suave); font-size: var(--mc-t-s); display: flex; gap: .3rem; align-items: center; }
.mc-siguientes__motivo span { color: var(--mc-enlace); flex: none; }
.mc-siguientes__ir { color: var(--mc-enlace); font-weight: 700; font-size: var(--mc-t-s); display: inline-flex; gap: .3rem; align-items: center; }
@media (min-width: 768px) {
  .mc-siguientes__lista { grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr)); }
  .mc-siguientes__tarjeta { grid-template-columns: 1fr; align-items: start; padding: .75rem; }
  .mc-siguientes__imagen { aspect-ratio: 42 / 15; }
}
</style>
