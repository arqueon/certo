import { isIP } from 'node:net'
import { fail } from './session'

/** Independent of Koa proxy mode; only the direct socket peer grants header trust. */
export function clientIp(ctx: any): string {
  const peer = ctx.req.socket?.remoteAddress || ''
  const source = process.env.PORTAL_TITULAR_IP_SOURCE || 'socket'
  if (!isIP(peer) || !['socket', 'cf-connecting-ip', 'xff-single'].includes(source)) {
    return fail(503, 'No se pudo comprobar la conexión al portal.')
  }
  if (source === 'socket') return peer
  const trusted = (process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (trusted.some(ip => !isIP(ip))) return fail(503, 'No se pudo comprobar la conexión al portal.')
  if (!trusted.includes(peer)) return peer
  const forwarded = ctx.get(source === 'cf-connecting-ip' ? 'cf-connecting-ip' : 'x-forwarded-for')
  // Missing headers, lists, duplicate headers and malformed values fail closed.
  if (typeof forwarded !== 'string' || !isIP(forwarded)) return fail(503, 'No se pudo comprobar la conexión al portal.')
  return forwarded
}
