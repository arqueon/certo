<script setup lang="ts">
import type { SolicitudSaberes } from '~/composables/useSaberesPrevios'

// Tarjeta de una solicitud de saberes previos en la dirección B: estado con su
// avance en cuatro pasos, plazo, respuesta y acciones. La lógica es la misma
// que la de la tarjeta original (useSolicitudTitular).
const props = defineProps<{ solicitud: SolicitudSaberes, correoVerificado: boolean }>()
const emit = defineEmits<{ actualizar: [solicitud: SolicitudSaberes], nueva: [solicitud: SolicitudSaberes] }>()
const { t, locale } = useI18n()
const { accion, descripcion, evidencias, motivo, enviando, error, mensaje, abrir, enviar, consultar }
  = useSolicitudTitular(() => props.solicitud, s => emit('actualizar', s), clave => t(`portal.b.saberes.msg.${clave}`))

function fecha(value?: string) {
  if (!value) {
    return t('portal.b.saberes.dateTbd')
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-06:00` : value)
  return Number.isNaN(date.getTime())
    ? t('portal.b.saberes.dateTbd')
    : date.toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })
}
const ESTADOS = ['presentada', 'en_revision', 'subsanada', 'no_procede', 'reconocida', 'reapertura_solicitada']
const estadoTexto = computed(() => t(`portal.b.saberes.estados.${ESTADOS.includes(props.solicitud.estado) ? props.solicitud.estado : 'otro'}`))
const tono = computed(() => ({ reconocida: 'ok', no_procede: 'no' } as Record<string, string>)[props.solicitud.estado] || 'esp')
// Avance: recibida → en revisión → respuesta → credencial emitida.
const paso = computed(() => {
  const e = props.solicitud.estado
  if (e === 'reconocida') {
    return props.solicitud.estadoCredencial === 'emitida' ? 4 : 3
  }
  if (e === 'no_procede') {
    return 3
  }
  return e === 'presentada' ? 1 : 2
})
const credenciales: Record<string, string> = {
  decidido_apto: 'credPending',
  emitida: 'credIssued',
  revocada: 'credRevoked',
  corregida: 'credCorrected',
  pendiente_decision: 'credDecision',
  decidido_no_apto: 'credNo',
}
const credencialTexto = computed(() => t(`portal.b.saberes.${credenciales[props.solicitud.estadoCredencial || ''] || 'credAsk'}`))
</script>

<template>
  <article class="mc-solicitud mc-tarjeta" data-testid="solicitud-saberes">
    <header class="mc-solicitud__cabeza">
      <div>
        <h3 class="mc-titulo">
          {{ solicitud.logro.nombre }}
        </h3>
        <p class="mc-suave">
          {{ solicitud.instanciaDestinataria }}
        </p>
      </div>
      <span class="mc-chip" :class="`mc-chip--${tono}`" data-testid="solicitud-estado">{{ estadoTexto }}</span>
    </header>

    <ol class="mc-solicitud__avance" :aria-label="t('portal.b.saberes.trackLabel')">
      <li
        v-for="n in 4"
        :key="n"
        :class="{
          'mc-solicitud__paso--hecho': n < paso || (n === paso && n === 4),
          'mc-solicitud__paso--actual': n === paso && n !== 4,
          'mc-solicitud__paso--no': n === 3 && paso === 3 && solicitud.estado === 'no_procede',
        }"
        :aria-current="n === paso ? 'step' : undefined"
      >
        <span aria-hidden="true">{{ n < paso || (n === paso && n === 4) ? '✓' : n }}</span>{{ t(`portal.b.saberes.track${n}`) }}
      </li>
    </ol>

    <p class="mc-solicitud__fechas">
      <span>{{ t('portal.b.saberes.sentOn', { date: fecha(solicitud.createdAt) }) }}</span>
      <strong v-if="!['reconocida', 'no_procede'].includes(solicitud.estado)">{{ t('portal.b.saberes.deadlineOn', { date: fecha(solicitud.fechaLimite) }) }}</strong>
    </p>
    <div v-if="solicitud.vencida" class="mc-aviso mc-aviso--esp" role="status">
      <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-clock" /></span>
      <p>{{ t('portal.b.saberes.overdue') }}</p>
    </div>

    <div v-if="solicitud.justificacion" class="mc-solicitud__respuesta" :class="`mc-solicitud__respuesta--${tono}`">
      <h4>{{ t('portal.b.saberes.answerFrom', { who: solicitud.instanciaDecide || t('portal.b.saberes.answerFallback') }) }}</h4>
      <p class="mc-solicitud__texto">
        {{ solicitud.justificacion }}
      </p>
      <p v-if="solicitud.criteriosEquivalencia" class="mc-solicitud__texto">
        <strong>{{ t('portal.b.saberes.criteriaUsed') }}:</strong> {{ solicitud.criteriosEquivalencia }}
      </p>
      <p v-if="solicitud.resueltaEn" class="mc-suave">
        {{ t('portal.b.saberes.answeredOn', { date: fecha(solicitud.resueltaEn) }) }}
      </p>
    </div>
    <p v-if="solicitud.estado === 'no_procede' && solicitud.subsanable && solicitud.indicacionesSubsanacion" class="mc-solicitud__texto">
      <strong>{{ t('portal.b.saberes.toComplete') }}:</strong> {{ solicitud.indicacionesSubsanacion }}
    </p>
    <p v-if="solicitud.motivoReapertura" class="mc-solicitud__texto">
      <strong>{{ t('portal.b.saberes.yourReason') }}:</strong> {{ solicitud.motivoReapertura }}
    </p>
    <p v-if="solicitud.respuestaReapertura" class="mc-solicitud__texto">
      <strong>{{ t('portal.b.saberes.reopenAnswer') }}:</strong> {{ solicitud.respuestaReapertura }}
    </p>

    <div v-if="solicitud.estado === 'reconocida'" class="mc-aviso mc-aviso--ok">
      <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-check-badge" /></span>
      <div class="mc-solicitud__nota">
        <p><strong>{{ t('portal.b.saberes.recognized') }}</strong> {{ t('portal.b.saberes.credential', { state: credencialTexto }) }}</p>
        <NuxtLink to="/dashboard" class="mc-boton mc-boton--secundario">
          {{ t('portal.b.saberes.goCredentials') }}
        </NuxtLink>
      </div>
    </div>
    <p v-if="solicitud.estado === 'no_procede'" class="mc-suave">
      {{ t('portal.b.saberes.notRecognized') }}
    </p>
    <p v-if="solicitud.reaperturaUsada" class="mc-suave">
      {{ t('portal.b.saberes.reopenUsed') }}
    </p>

    <details class="mc-solicitud__envio">
      <summary>{{ t('portal.b.saberes.yourText') }}</summary>
      <p class="mc-solicitud__texto">
        {{ solicitud.descripcionSaberes }}
      </p>
      <p v-if="solicitud.evidencias" class="mc-solicitud__texto">
        <strong>{{ t('portal.b.saberes.yourEvidence') }}:</strong> {{ solicitud.evidencias }}
      </p>
      <p v-if="solicitud.fechaLogro" class="mc-suave">
        {{ t('portal.b.saberes.achievedOn', { date: fecha(solicitud.fechaLogro) }) }}
      </p>
    </details>

    <div class="mc-solicitud__acciones">
      <template v-if="solicitud.estado === 'no_procede'">
        <button v-if="solicitud.subsanable" type="button" class="mc-boton" :disabled="enviando" @click="abrir('subsanar')">
          {{ t('portal.b.saberes.complete') }}
        </button>
        <button v-if="!solicitud.reaperturaUsada" type="button" class="mc-boton mc-boton--secundario" :disabled="enviando" @click="abrir('reapertura')">
          {{ t('portal.b.saberes.reopen') }}
        </button>
        <button type="button" class="mc-boton mc-boton--secundario" :disabled="enviando" @click="emit('nueva', solicitud)">
          {{ t('portal.b.saberes.again') }}
        </button>
      </template>
      <button v-if="!solicitud.correoVerificado && !solicitud.estadoCredencial" type="button" class="mc-boton mc-boton--secundario" :disabled="enviando || !correoVerificado" @click="enviar('confirmar-correo')">
        {{ t('portal.b.saberes.confirmEmail') }}
      </button>
      <button type="button" class="mc-boton mc-boton--texto" :disabled="enviando" @click="consultar">
        {{ t('portal.b.saberes.check2') }}
      </button>
    </div>

    <form v-if="accion" class="mc-solicitud__form" @submit.prevent="enviar(accion)">
      <template v-if="accion === 'subsanar'">
        <label class="mc-campo"><span>{{ t('portal.b.saberes.descripcion') }}</span><textarea v-model="descripcion" required maxlength="20000" rows="4" /></label>
        <label class="mc-campo"><span>{{ t('portal.b.saberes.completeEvidence') }}</span><textarea v-model="evidencias" maxlength="20000" rows="3" /></label>
        <p class="mc-suave">
          {{ t('portal.b.saberes.completeHelp') }}
        </p>
      </template>
      <template v-else>
        <label class="mc-campo"><span>{{ t('portal.b.saberes.reopenWhy') }}</span><textarea v-model="motivo" required maxlength="10000" rows="3" /></label>
        <p class="mc-suave">
          {{ t('portal.b.saberes.reopenHelp') }}
        </p>
      </template>
      <p v-if="solicitud.estado !== 'no_procede'" class="mc-suave">
        {{ t('portal.b.saberes.changed') }}
      </p>
      <div class="mc-solicitud__acciones">
        <button class="mc-boton" :disabled="enviando || solicitud.estado !== 'no_procede' || (accion === 'subsanar' ? !solicitud.subsanable : solicitud.reaperturaUsada)">
          {{ enviando ? t('portal.b.saberes.sending') : t('portal.b.saberes.send') }}
        </button>
        <button type="button" class="mc-boton mc-boton--texto" :disabled="enviando" @click="accion = ''">
          {{ t('portal.b.saberes.close') }}
        </button>
      </div>
    </form>
    <p v-if="error" class="mc-solicitud__error" role="alert">
      {{ error }}
    </p>
    <p v-if="mensaje" class="mc-solicitud__ok" role="status">
      {{ mensaje }}
    </p>
  </article>
</template>

<style scoped>
.mc-solicitud { padding: 1.25rem; display: grid; gap: .9rem; }
.mc-solicitud__cabeza { display: flex; flex-wrap: wrap; gap: .6rem 1rem; justify-content: space-between; align-items: flex-start; }
.mc-solicitud__cabeza > div { display: grid; gap: .2rem; min-width: 0; flex: 1 1 14rem; }
.mc-solicitud__cabeza h3 { font-size: var(--mc-t-l); overflow-wrap: anywhere; }
.mc-solicitud__avance { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .35rem; counter-reset: paso; }
.mc-solicitud__avance li {
  display: grid; justify-items: center; gap: .3rem; text-align: center;
  font-size: var(--mc-t-xs); font-weight: 600; color: var(--mc-suave); position: relative;
}
.mc-solicitud__avance li::before {
  content: ''; position: absolute; top: .9rem; left: -50%; right: 50%; height: 2px; background: var(--mc-linea); z-index: 0;
}
.mc-solicitud__avance li:first-child::before { display: none; }
.mc-solicitud__avance li > span {
  position: relative; z-index: 1; display: grid; place-items: center; width: 1.8rem; height: 1.8rem; border-radius: 50%;
  border: 2px solid var(--mc-linea); background: var(--mc-superficie); font: 800 var(--mc-t-xs) var(--mc-fuente-titulos);
}
.mc-solicitud__avance .mc-solicitud__paso--hecho { color: var(--mc-texto); }
.mc-solicitud__avance .mc-solicitud__paso--hecho > span { background: var(--mc-ok); border-color: var(--mc-ok); color: var(--mc-superficie); }
.mc-solicitud__avance .mc-solicitud__paso--hecho::before, .mc-solicitud__avance .mc-solicitud__paso--actual::before { background: var(--mc-ok); }
.mc-solicitud__avance .mc-solicitud__paso--actual { color: var(--mc-texto); }
.mc-solicitud__avance .mc-solicitud__paso--actual > span { border-color: var(--mc-enlace); color: var(--mc-enlace); box-shadow: 0 0 0 4px color-mix(in srgb, var(--mc-enlace) 18%, transparent); }
.mc-solicitud__avance .mc-solicitud__paso--no > span { border-color: var(--mc-no); color: var(--mc-no); box-shadow: 0 0 0 4px var(--mc-no-fondo); }
.mc-solicitud__fechas { display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: var(--mc-t-s); }
.mc-solicitud__respuesta { border-left: 4px solid var(--mc-enlace); background: var(--mc-hielo); border-radius: 0 var(--mc-r-s) var(--mc-r-s) 0; padding: .85rem 1rem; display: grid; gap: .45rem; }
.mc-solicitud__respuesta--ok { border-left-color: var(--mc-ok); }
.mc-solicitud__respuesta--no { border-left-color: var(--mc-no); }
.mc-solicitud__respuesta h4 { font-weight: 800; }
.mc-solicitud__texto { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
.mc-solicitud__nota { display: grid; gap: .6rem; justify-items: start; }
.mc-solicitud__envio summary { cursor: pointer; color: var(--mc-enlace); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.mc-solicitud__envio[open] { display: grid; gap: .5rem; }
.mc-solicitud__acciones { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.mc-solicitud__form { display: grid; gap: .8rem; padding-top: .9rem; border-top: 1px solid var(--mc-linea); }
.mc-solicitud__error { color: var(--mc-no); font-weight: 600; }
.mc-solicitud__ok { color: var(--mc-ok); font-weight: 600; }
</style>
