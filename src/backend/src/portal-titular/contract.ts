import { fail } from './session'

export type Action = 'catalogo' | 'ficha' | 'instancias' | 'listar' | 'consultar' | 'presentar' | 'subsanar' | 'reapertura' | 'confirmar-correo'
export function route(method: string, target: string): Action {
  const [path, query, extra] = target.split('?')
  if (extra !== undefined || query === '') return fail(403, 'Ruta no permitida.')
  const id = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
  let action: Action | undefined
  if (method === 'GET') {
    if (path === '/api/portal-titular/catalogo-publico') action = 'catalogo'
    if (path.startsWith('/api/portal-titular/catalogo-publico/')) {
      const key = path.slice('/api/portal-titular/catalogo-publico/'.length)
      try {
        if (!key || key.length > 768 || encodeURIComponent(decodeURIComponent(key)) !== key
          || /[/\\\x00-\x1f]/.test(decodeURIComponent(key)) || ['.', '..'].includes(key)) throw new Error()
        action = 'ficha'
      } catch { return fail(403, 'Ruta no permitida.') }
    }
    if (path === '/api/portal-titular/instancias') action = 'instancias'
    if (path === '/api/portal-titular/solicitudes-saberes') action = 'listar'
    if (new RegExp(`^/api/portal-titular/solicitudes-saberes/${id}$`).test(path)) action = 'consultar'
  }
  if (method === 'POST') {
    if (path === '/api/portal-titular/solicitudes-saberes') action = 'presentar'
    const match = path.match(new RegExp(`^/api/portal-titular/solicitudes-saberes/${id}/(subsanar|reapertura|confirmar-correo)$`))
    if (match) action = match[1] as Action
  }
  if (!action || (query !== undefined && !(action === 'listar' && /^pagina=[1-9]\d{0,5}$/.test(query)))) {
    return fail(403, 'Ruta no permitida.')
  }
  return action
}
const fields: Partial<Record<Action, string[]>> = {
  presentar: ['nombreCompleto', 'claveLogro', 'instancia', 'descripcionSaberes', 'matricula', 'evidencias', 'fechaLogro', 'solicitudAnterior'],
  subsanar: ['descripcionSaberes', 'evidencias'], reapertura: ['motivo'], 'confirmar-correo': [],
}
export function bodyFor(action: Action, value: any): string {
  if (!fields[action]) return ''
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => k !== 'data')
    || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) return fail(400, 'Revisa los datos de tu solicitud.')
  const input = value.data
  if (Object.keys(input).some(k => !fields[action]!.includes(k))) return fail(400, 'La solicitud contiene campos no permitidos.')
  const result: Record<string, string> = {}
  for (const k of fields[action]!) {
    if (input[k] === undefined) continue
    if (typeof input[k] !== 'string' || input[k].includes('\0')) return fail(400, 'Revisa la extensión y el contenido de los campos.')
    result[k] = input[k]
  }
  const required = action === 'presentar' ? ['nombreCompleto', 'claveLogro', 'instancia', 'descripcionSaberes']
    : action === 'subsanar' ? ['descripcionSaberes'] : action === 'reapertura' ? ['motivo'] : []
  if (required.some(k => !result[k]?.trim())) return fail(400, 'Completa los campos obligatorios antes de enviar.')
  if (result.fechaLogro && (!/^\d{4}-\d{2}-\d{2}$/.test(result.fechaLogro)
    || !Number.isFinite(Date.parse(result.fechaLogro)) || new Date(result.fechaLogro).toISOString().slice(0, 10) !== result.fechaLogro)) {
    return fail(400, 'Revisa la fecha de logro.')
  }
  const body = JSON.stringify({ data: result })
  if (Buffer.byteLength(body) > 65536) return fail(413, 'Acorta la descripción o las evidencias antes de enviar.')
  return body
}

const solicitudFields = ['referencia', 'estado', 'createdAt', 'fechaLimite', 'vencida', 'subsanable', 'correoVerificado',
  'indicacionesSubsanacion', 'reaperturaUsada', 'motivoReapertura', 'respuestaReapertura', 'solicitanteNombre', 'correo',
  'matricula', 'descripcionSaberes', 'evidencias', 'instancia', 'instanciaDestinataria', 'fechaLogro', 'justificacion',
  'criteriosEquivalencia', 'instanciaDecide', 'resueltaPorNombre', 'resueltaEn', 'estadoCredencial']
function pick(source: any, keys: string[]) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  return Object.fromEntries(keys.filter(k => Object.prototype.hasOwnProperty.call(source, k)).map(k => [k, source[k]]))
}
export function project(action: Action, value: any) {
  if (!value || !Object.prototype.hasOwnProperty.call(value, 'data')) return fail(502, 'No pudimos consultar la respuesta. Inténtalo de nuevo.')
  const solicitud = (s: any) => ({ ...pick(s, solicitudFields), logro: pick(s.logro, ['clave', 'nombre']) })
  if (action === 'instancias') return { data: value.data.map((i: any) => pick(i, ['clave', 'nombre', 'activa'])) }
  if (action === 'catalogo' || action === 'ficha') return { data: value.data } // Console's public, versioned projection.
  if (action === 'listar') return { data: value.data.map(solicitud), meta: { pagina: value.meta?.pagina } }
  return { data: solicitud(value.data) }
}
