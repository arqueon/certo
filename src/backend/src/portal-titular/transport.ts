import { isIP } from 'node:net'
import { createHmac } from 'node:crypto'
import type { Action } from './contract'
import { project, route } from './contract'
import type { Actor } from './session'
import { digest, fail, httpsUrl, random, PortalError } from './session'

export interface PortalRequest { method: string; target: string; action: Action; body: string; actor: Actor; ip: string; idempotencyKey?: string }
/** Byte-exact realization of the README envelope; see docs/portal-titular.md. */
export function sign(request: PortalRequest, key: string, timestamp = String(Date.now()), nonce = random()) {
  // Construct afresh, never spread a browser-supplied object or roles.
  const { sub, email, email_verified, name } = request.actor
  const actor = Buffer.from(JSON.stringify({ sub, email, email_verified, name }), 'utf8').toString('base64url')
  const base = JSON.stringify(['1', 'portal-titular', request.method, request.target, digest(request.body), timestamp, nonce, actor, request.ip, request.idempotencyKey || ''])
  return {
    'X-UDG-Portal-Version': '1', 'X-UDG-Portal-Client': 'portal-titular',
    'X-UDG-Portal-Timestamp': timestamp, 'X-UDG-Portal-Nonce': nonce,
    'X-UDG-Portal-Actor': actor, 'X-UDG-Portal-IP': request.ip,
    ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
    'X-UDG-Portal-Signature': createHmac('sha256', key).update(base, 'utf8').digest('hex'),
  }
}
const errors: Record<number, string> = {
  400: 'Revisa los campos y las indicaciones de la solicitud. Para presentar, tu correo debe estar verificado.',
  401: 'No se pudo comprobar tu acceso. Vuelve a entrar con tu cuenta.',
  403: 'Esta acción no está disponible para tu cuenta.',
  404: 'No se encontró esta solicitud o ficha entre las disponibles para tu cuenta.',
  409: 'La solicitud cambió o esta acción ya fue realizada. Consulta el estado actualizado antes de continuar.',
  413: 'Acorta la descripción o las evidencias antes de enviar.',
  503: 'El servicio no está disponible por el momento. Conserva lo escrito e inténtalo más adelante.',
  429: 'Se recibieron varios intentos. Espera unos minutos antes de volver a enviar.',
}
// Solo laboratorio: HTTP hacia un servicio de la red Docker privada (nombre sin
// punto) con bandera explícita. En la instancia oficial la consola va por HTTPS.
function consolaUrl(): URL {
  const raw = process.env.PORTAL_TITULAR_CONSOLA_URL || ''
  if (process.env.PORTAL_TITULAR_CONSOLA_HTTP_INTERNO === 'true') {
    let url: URL
    try { url = new URL(raw) } catch { return fail(503, 'Esta sección no está disponible por el momento.') }
    if (url.protocol === 'http:' && !url.hostname.includes('.') && !url.username && !url.password && !url.search && !url.hash) return url
  }
  return httpsUrl(raw)
}

export async function proxy(request: PortalRequest, send: typeof fetch = fetch) {
  if (route(request.method, request.target) !== request.action) return fail(403, 'Ruta no permitida.')
  const url = consolaUrl()
  if (url.pathname !== '/') return fail(503, 'Esta sección no está disponible por el momento.')
  if (!isIP(request.ip)) return fail(503, 'No se pudo comprobar la conexión al portal.')
  if (request.action === 'presentar' ? !/^[A-Za-z0-9_-]{16,128}$/.test(request.idempotencyKey || '') : !!request.idempotencyKey) {
    return fail(400, 'No se pudo identificar el envío. Revisa el formulario antes de continuar.')
  }
  const key = process.env.PORTAL_TITULAR_HMAC_SECRET || ''
  if (!/^[a-f0-9]{64}$/.test(key)) return fail(503, 'Esta sección no está disponible por el momento.')
  const headers: Record<string, string> = { Accept: 'application/json' }
  Object.assign(headers, sign(request, key))
  if (request.method === 'POST') headers['Content-Type'] = 'application/json; charset=utf-8'
  // Exact serialized body is hashed and sent. No cookies, Authorization, roles or inbound headers forwarded.
  const response = await send(`${url.origin}${request.target}`, {
    method: request.method, headers, ...(request.method === 'POST' ? { body: request.body } : {}),
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 429) {
    const seconds = Number(response.headers.get('retry-after'))
    const error = new PortalError(429, errors[429])
    error.retryAfter = Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400 ? seconds : 600
    throw error
  }
  if (!response.ok) return fail(errors[response.status] ? response.status : 502,
    errors[response.status] || 'No pudimos confirmar la respuesta. Consulta tus solicitudes antes de volver a enviar.')
  const expected = request.action === 'presentar' ? 201 : 200
  if (response.status !== expected) return fail(502, 'La respuesta no pudo confirmarse. Consulta tus solicitudes antes de volver a enviar.')
  return { status: response.status, body: project(request.action, await response.json()) }
}
