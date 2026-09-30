<script setup lang="ts">
import type { SolicitudSaberes } from '~/composables/useSaberesPrevios'
import { estadosSaberes, fechaSaberes } from '~/composables/useSaberesPrevios'
const props = defineProps<{ solicitud: SolicitudSaberes; correoVerificado: boolean }>()
const emit = defineEmits<{ actualizar: [solicitud: SolicitudSaberes]; nueva: [solicitud: SolicitudSaberes] }>()
const { request } = useSaberesPrevios()
const accion = ref('')
const descripcion = ref('')
const evidencias = ref('')
const motivo = ref('')
const enviando = ref(false)
const error = ref('')
const mensaje = ref('')
const emisiones: Record<string, string> = { decidido_apto: 'Pendiente de emisión', emitida: 'Emitida',
  revocada: 'Revocada', corregida: 'Corregida', pendiente_decision: 'Pendiente de decisión', decidido_no_apto: 'No autorizada para emisión' }
function abrir(tipo: string) {
  accion.value = tipo; error.value = ''; mensaje.value = ''
  descripcion.value = props.solicitud.descripcionSaberes
  evidencias.value = props.solicitud.evidencias || ''; motivo.value = ''
}
async function releer() {
  const r = await request<{ data: SolicitudSaberes }>(`solicitudes-saberes/${encodeURIComponent(props.solicitud.referencia)}`)
  emit('actualizar', r.data)
}
async function enviar(tipo: string) {
  if (enviando.value) return
  enviando.value = true; error.value = ''; mensaje.value = ''
  try {
    const data = tipo === 'subsanar' ? { descripcionSaberes: descripcion.value, evidencias: evidencias.value }
      : tipo === 'reapertura' ? { motivo: motivo.value } : {}
    const result = await request<{ data: SolicitudSaberes }>(`solicitudes-saberes/${encodeURIComponent(props.solicitud.referencia)}/${tipo}`, data)
    emit('actualizar', result.data); accion.value = ''; mensaje.value = 'Tu envío quedó registrado.'
  } catch (e: any) {
    const status = e.statusCode || e.status
    error.value = status === 401 ? 'Tu sesión terminó. Conserva lo escrito y vuelve a entrar con tu cuenta.'
      : status === 409 ? 'La solicitud cambió. Revisa el estado actualizado antes de continuar; conservamos lo escrito.'
        : e.data?.error?.message || 'No pudimos confirmar el envío. Conservamos lo escrito; consulta el estado antes de repetirlo.'
    if (status === 409 || !status || status >= 500) {
      try { await releer() } catch { error.value += ' No se pudo actualizar el estado. Inténtalo con «Consultar estado».' }
    }
  } finally { enviando.value = false }
}
async function consultar() {
  try { await releer(); mensaje.value = 'Estado actualizado.' } catch { error.value = 'No se pudo consultar el estado. Vuelve a intentarlo.' }
}
</script>

<template>
  <article class="solicitud">
    <h3>{{ solicitud.logro.nombre }}</h3>
    <p><strong>{{ estadosSaberes[solicitud.estado] || 'Consulta en curso' }}</strong> · {{ solicitud.instanciaDestinataria }}</p>
    <p>Presentaste esta solicitud el {{ fechaSaberes(solicitud.createdAt) }}.</p>
    <p>Fecha límite de respuesta: <strong>{{ fechaSaberes(solicitud.fechaLimite) }}</strong>.</p>
    <p v-if="solicitud.vencida" role="status" class="aviso">El plazo venció. Tu solicitud sigue disponible para su atención; puedes consultar el avance con la instancia que la recibe.</p>
    <details>
      <summary>Ver lo que presentaste</summary>
      <p class="texto">{{ solicitud.descripcionSaberes }}</p>
      <p v-if="solicitud.evidencias" class="texto"><strong>Evidencias:</strong> {{ solicitud.evidencias }}</p>
      <p v-if="solicitud.fechaLogro">Fecha de logro: {{ fechaSaberes(solicitud.fechaLogro) }}</p>
    </details>
    <div v-if="solicitud.justificacion" class="respuesta">
      <h4>Respuesta de {{ solicitud.instanciaDecide || 'la instancia que revisó tu solicitud' }}</h4>
      <p class="texto">{{ solicitud.justificacion }}</p>
      <p v-if="solicitud.criteriosEquivalencia" class="texto"><strong>Criterios usados para decidir:</strong> {{ solicitud.criteriosEquivalencia }}</p>
      <p v-if="solicitud.resueltaEn">Respondida el {{ fechaSaberes(solicitud.resueltaEn) }}.</p>
    </div>
    <p v-if="solicitud.estado === 'no_procede' && solicitud.subsanable && solicitud.indicacionesSubsanacion" class="texto"><strong>Qué debes completar:</strong> {{ solicitud.indicacionesSubsanacion }}</p>
    <p v-if="solicitud.motivoReapertura" class="texto"><strong>Tu motivo para reabrir:</strong> {{ solicitud.motivoReapertura }}</p>
    <p v-if="solicitud.respuestaReapertura" class="texto"><strong>Respuesta a la reapertura:</strong> {{ solicitud.respuestaReapertura }}</p>
    <template v-if="solicitud.estado === 'reconocida'">
      <p>Tus saberes fueron reconocidos. Credencial: {{ emisiones[solicitud.estadoCredencial || ''] || 'Consulta el avance con tu instancia' }}.</p>
      <NuxtLink to="/dashboard">Consultar mis credenciales</NuxtLink>
    </template>
    <p v-if="solicitud.estado === 'no_procede'">Lee el motivo de la respuesta. Puedes presentar una solicitud nueva, incluso con las mismas evidencias; en ese caso se avisará a quien la revise.</p>
    <p v-if="solicitud.reaperturaUsada">Ya pediste la única reapertura de esta solicitud. Si necesitas otra revisión, puedes presentar una solicitud nueva.</p>
    <div class="acciones">
      <button type="button" :disabled="enviando" @click="consultar">Consultar estado</button>
      <button v-if="!solicitud.correoVerificado && !solicitud.estadoCredencial" type="button" :disabled="enviando || !correoVerificado" @click="enviar('confirmar-correo')">Confirmar mi correo verificado</button>
      <template v-if="solicitud.estado === 'no_procede'">
        <button v-if="solicitud.subsanable" type="button" :disabled="enviando" @click="abrir('subsanar')">Completar solicitud</button>
        <button v-if="!solicitud.reaperturaUsada" type="button" :disabled="enviando" @click="abrir('reapertura')">Pedir reapertura</button>
        <button type="button" :disabled="enviando" @click="emit('nueva', solicitud)">Presentar una solicitud nueva</button>
      </template>
    </div>
    <form v-if="accion" @submit.prevent="enviar(accion)">
      <template v-if="accion === 'subsanar'">
        <label>Qué sabes hacer y cómo lo aprendiste<textarea v-model="descripcion" required maxlength="20000" rows="4" /></label>
        <label>Evidencias que completas según las indicaciones<textarea v-model="evidencias" maxlength="20000" rows="3" /></label>
        <p>Al completar la información, el plazo de diez días hábiles comienza de nuevo.</p>
      </template>
      <template v-else>
        <label>Por qué pides revisar de nuevo esta solicitud<textarea v-model="motivo" required maxlength="10000" rows="3" /></label>
        <p>Puedes pedir una reapertura por solicitud. Esta oportunidad se usa aunque se rechace. Si se acepta, comienza de nuevo el plazo de diez días hábiles.</p>
      </template>
      <p v-if="solicitud.estado !== 'no_procede'">El estado cambió. Conservamos tu texto para que puedas revisarlo o copiarlo.</p>
      <div class="acciones">
        <button :disabled="enviando || solicitud.estado !== 'no_procede' || (accion === 'subsanar' ? !solicitud.subsanable : solicitud.reaperturaUsada)">{{ enviando ? 'Enviando…' : 'Enviar' }}</button>
        <button type="button" :disabled="enviando" @click="accion = ''">Cerrar formulario</button>
      </div>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="mensaje" role="status">{{ mensaje }}</p>
  </article>
</template>
