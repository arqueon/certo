export interface SolicitudSaberes {
  referencia: string
  estado: string
  createdAt: string
  fechaLimite?: string
  vencida?: boolean
  subsanable?: boolean
  correoVerificado?: boolean
  reaperturaUsada?: boolean
  solicitanteNombre?: string
  matricula?: string
  instancia?: string
  instanciaDestinataria?: string
  descripcionSaberes: string
  evidencias?: string
  fechaLogro?: string
  logro: { clave: string; nombre: string }
  justificacion?: string
  criteriosEquivalencia?: string
  indicacionesSubsanacion?: string
  motivoReapertura?: string
  respuestaReapertura?: string
  instanciaDecide?: string
  resueltaEn?: string
  estadoCredencial?: string
}
export const estadosSaberes: Record<string, string> = {
  presentada: 'Recibida', en_revision: 'En revisión', subsanada: 'Información completada',
  no_procede: 'No reconocida', reconocida: 'Saberes reconocidos', reapertura_solicitada: 'Reapertura solicitada',
}
export function fechaSaberes(value?: string): string {
  if (!value) return 'Por confirmar'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-06:00` : value)
  return Number.isNaN(date.getTime()) ? 'Por confirmar' : date.toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
  })
}
export function useSaberesPrevios() {
  const config = useRuntimeConfig()
  const enabled = String(config.public.portalTitularEnabled) === 'true'
  const baseURL = String(config.public.apiUrl || '').replace(/\/$/, '')
  const loginUrl = `${baseURL}/api/portal-titular/auth/iniciar`
  async function request<T = any>(path: string, data?: object, idempotencyKey?: string): Promise<T> {
    if (!enabled) throw new Error('Portal del titular deshabilitado')
    return await $fetch<T>(`/api/portal-titular/${path}`, {
      baseURL, method: data === undefined ? 'GET' : 'POST', credentials: 'include',
      timeout: path === 'auth/salir' ? 3000 : 20_000,
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
      ...(data === undefined ? {} : { body: { data } }), retry: 0,
    }) as T
  }
  return { request, enabled, loginUrl }
}
