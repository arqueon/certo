import type { SolicitudSaberes } from '~/composables/useSaberesPrevios'

// Acciones de la persona titular sobre una solicitud de saberes previos
// (consultar, completar, pedir reapertura, confirmar correo). Las comparten la
// tarjeta original y la de la dirección B; solo cambia la presentación.
// Textos de la tarjeta original (solo en español). La de la dirección B pasa
// su propia función de traducción con las claves portal.b.saberes.msg.*.
const MENSAJES: Record<string, string> = {
  registrado: 'Tu envío quedó registrado.',
  sesion: 'Tu sesión terminó. Conserva lo escrito y vuelve a entrar con tu cuenta.',
  cambio: 'La solicitud cambió. Revisa el estado actualizado antes de continuar; conservamos lo escrito.',
  incierto: 'No pudimos confirmar el envío. Conservamos lo escrito; consulta el estado antes de repetirlo.',
  sinEstado: ' No se pudo actualizar el estado. Inténtalo con «Consultar estado».',
  actualizado: 'Estado actualizado.',
  noConsulta: 'No se pudo consultar el estado. Vuelve a intentarlo.',
}

export function useSolicitudTitular(
  solicitud: () => SolicitudSaberes,
  onActualizar: (s: SolicitudSaberes) => void,
  texto: (clave: string) => string = clave => MENSAJES[clave] || clave,
) {
  const { request } = useSaberesPrevios()
  const accion = ref('')
  const descripcion = ref('')
  const evidencias = ref('')
  const motivo = ref('')
  const enviando = ref(false)
  const error = ref('')
  const mensaje = ref('')

  function abrir(tipo: string) {
    accion.value = tipo
    error.value = ''
    mensaje.value = ''
    descripcion.value = solicitud().descripcionSaberes
    evidencias.value = solicitud().evidencias || ''
    motivo.value = ''
  }
  async function releer() {
    const r = await request<{ data: SolicitudSaberes }>(`solicitudes-saberes/${encodeURIComponent(solicitud().referencia)}`)
    onActualizar(r.data)
  }
  async function enviar(tipo: string) {
    if (enviando.value) {
      return
    }
    enviando.value = true
    error.value = ''
    mensaje.value = ''
    try {
      const data = tipo === 'subsanar'
        ? { descripcionSaberes: descripcion.value, evidencias: evidencias.value }
        : tipo === 'reapertura' ? { motivo: motivo.value } : {}
      const result = await request<{ data: SolicitudSaberes }>(`solicitudes-saberes/${encodeURIComponent(solicitud().referencia)}/${tipo}`, data)
      onActualizar(result.data)
      accion.value = ''
      mensaje.value = texto('registrado')
    }
    catch (e: any) {
      const status = e.statusCode || e.status
      error.value = status === 401
        ? texto('sesion')
        : status === 409
          ? texto('cambio')
          : e.data?.error?.message || texto('incierto')
      if (status === 409 || !status || status >= 500) {
        try {
          await releer()
        }
        catch { error.value += texto('sinEstado') }
      }
    }
    finally { enviando.value = false }
  }
  async function consultar() {
    try {
      await releer()
      mensaje.value = texto('actualizado')
    }
    catch { error.value = texto('noConsulta') }
  }
  return { accion, descripcion, evidencias, motivo, enviando, error, mensaje, abrir, enviar, consultar }
}
