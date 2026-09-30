import { performance } from 'node:perf_hooks'
import { clientIp } from '../portal-titular/client-ip'
export { clientIp } from '../portal-titular/client-ip'
import { Action, bodyFor, route } from '../portal-titular/contract'
import { checkOrigin, clearSession, config, fail, finishLogin, PortalError, session, startLogin } from '../portal-titular/session'
import { proxy } from '../portal-titular/transport'

const PREFIX = '/api/portal-titular'
export async function readBody(ctx: any) {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(ctx.get('content-type')) || ctx.get('content-encoding')) {
    return fail(400, 'El formulario debe enviarse como datos JSON sin comprimir.')
  }
  if (Number(ctx.get('content-length')) > 65536) return fail(413, 'Acorta la descripción o las evidencias antes de enviar.')
  const chunks: Buffer[] = []; let size = 0
  const timer = setTimeout(() => ctx.req.destroy(), 15_000)
  try {
    for await (const chunk of ctx.req) {
      const bytes = Buffer.from(chunk); size += bytes.length
      if (size > 65536) return fail(413, 'Acorta la descripción o las evidencias antes de enviar.')
      chunks.push(bytes)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { return fail(400, 'No pudimos leer el formulario. Revisa los datos y vuelve a intentarlo.') }
  } finally { clearTimeout(timer) }
}
function logPath(path: string): string {
  // Templates only: even a catalog key or a request reference can identify a person.
  if (/^\/api\/portal-titular\/(?:auth\/(?:iniciar|callback|salir)|sesion|instancias|catalogo-publico|solicitudes-saberes)$/.test(path)) return path
  if (path.startsWith(`${PREFIX}/catalogo-publico/`)) return `${PREFIX}/catalogo-publico/:clave`
  const detail = path.match(/^\/api\/portal-titular\/solicitudes-saberes\/[^/]+(?:\/(subsanar|reapertura|confirmar-correo))?$/)
  if (detail) return `${PREFIX}/solicitudes-saberes/:referencia${detail[1] ? `/${detail[1]}` : ''}`
  return `${PREFIX}/:ruta`
}
export default (_config: any, { strapi }: { strapi: any }) => async (ctx: any, next: any) => {
  if (ctx.path !== PREFIX && !ctx.path.startsWith(`${PREFIX}/`)) return next()
  const started = performance.now()
  ctx.set('Cache-Control', 'no-store'); ctx.set('Referrer-Policy', 'no-referrer')
  ctx.set('X-Content-Type-Options', 'nosniff')
  try {
    if (process.env.PORTAL_TITULAR_ENABLED !== 'true') return fail(503, 'Esta sección no está disponible por el momento.')
    config()
    checkOrigin(ctx)
    // Reject aliases, duplicate parameters and route normalization before signing.
    const original = ctx.originalUrl || ctx.url
    if (!original.startsWith(`${PREFIX}/`)) return fail(403, 'Ruta no permitida.')
    if (ctx.method === 'GET' && ctx.path === `${PREFIX}/auth/iniciar` && !ctx.querystring) return await startLogin(ctx)
    if (ctx.method === 'GET' && ctx.path === `${PREFIX}/auth/callback`) {
      try { return await finishLogin(ctx) }
      catch {
        clearSession(ctx)
        ctx.redirect(`${config().origin}/saberes-previos?acceso=fallido`)
        return
      }
    }
    const authenticated = session(ctx)
    if (ctx.method === 'GET' && original === `${PREFIX}/sesion`) {
      const a = authenticated.actor
      ctx.body = { data: { nombre: a.name, correo: a.email, correoVerificado: a.email_verified } }; return
    }
    if (ctx.method === 'POST' && original === `${PREFIX}/auth/salir`) {
      await readBody(ctx); clearSession(ctx); ctx.body = { data: { ok: true } }; return
    }
    const target = original
    const action: Action = route(ctx.method, target)
    if (ctx.method === 'GET' && (ctx.get('transfer-encoding') || Number(ctx.get('content-length')) > 0)) return fail(400, 'Esta consulta no admite cuerpo.')
    const body = ctx.method === 'POST' ? bodyFor(action, await readBody(ctx)) : ''
    if (['presentar', 'confirmar-correo'].includes(action) && !authenticated.actor.email_verified) {
      return fail(400, 'Verifica el correo de tu cuenta y vuelve a entrar antes de enviar.')
    }
    const result = await proxy({ method: ctx.method, target, action, body, actor: authenticated.actor,
      ip: clientIp(ctx), idempotencyKey: ctx.get('idempotency-key') || undefined })
    ctx.status = result.status; ctx.body = result.body
  } catch (e) {
    ctx.status = e instanceof PortalError ? e.status : 502
    if (e instanceof PortalError && e.retryAfter) ctx.set('Retry-After', String(e.retryAfter))
    ctx.body = { error: { status: ctx.status, ...(e instanceof PortalError && e.retryAfter ? { retryAfter: e.retryAfter } : {}), message: e instanceof PortalError ? e.message
      : 'No pudimos confirmar la respuesta. Conserva lo escrito y consulta tus solicitudes antes de volver a enviar.' } }
  } finally {
    if (ctx.status === 502) {
      strapi.log.warn(JSON.stringify({ path: logPath(ctx.path), status: 502, durationMs: Math.round(performance.now() - started) }))
    }
  }
}
