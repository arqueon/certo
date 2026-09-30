import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type Actor = { sub: string; email: string; email_verified: boolean; name: string }
export type Session = { actor: Actor; exp: number }
export class PortalError extends Error {
  retryAfter?: number
  constructor(public status: number, message: string) { super(message) }
}
export const fail = (status: number, message: string): never => { throw new PortalError(status, message) }
export const random = () => randomBytes(32).toString('base64url')
export const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export function httpsUrl(value: string | undefined): URL {
  let url: URL
  try { url = new URL(value || '') } catch { return fail(503, 'Esta sección no está disponible por el momento.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return fail(503, 'Esta sección no está disponible por el momento.')
  }
  return url
}
export function config() {
  const publicUrl = httpsUrl(process.env.PORTAL_TITULAR_PUBLIC_URL)
  const frontend = httpsUrl(process.env.FRONTEND_URL)
  const issuer = httpsUrl(process.env.KEYCLOAK_PUBLIC_URL).href.replace(/\/$/, '')
  const internal = httpsUrl(process.env.KEYCLOAK_INTERNAL_URL || issuer).href.replace(/\/$/, '')
  const key = process.env.PORTAL_TITULAR_SESSION_KEY || ''
  const client = process.env.KEYCLOAK_CLIENT_ID || 'certo'
  const secret = process.env.KEYCLOAK_CLIENT_SECRET || ''
  if (publicUrl.pathname !== '/' || frontend.pathname !== '/'
    || key.length < 32 || !secret || key === process.env.PORTAL_TITULAR_HMAC_SECRET) {
    return fail(503, 'Esta sección no está disponible por el momento.')
  }
  return { origin: frontend.origin, issuer, internal, key, client, secret,
    callback: `${publicUrl.origin}/api/portal-titular/auth/callback` }
}

// Separate purposes prevent a login transaction from being accepted as a session.
export function seal(value: object, key: string, purpose: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(key).digest(), iv)
  cipher.setAAD(Buffer.from(purpose))
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}
export function unseal(token: string | undefined, key: string, purpose: string): any {
  try {
    if (!token || token.length > 3800) throw new Error()
    const bytes = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(key).digest(), bytes.subarray(0, 12))
    decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(bytes.subarray(12, 28))
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'))
    if (!Number.isFinite(data.exp) || data.exp <= Date.now() / 1000) throw new Error()
    return data
  } catch { return fail(401, 'Tu sesión terminó. Vuelve a entrar con tu cuenta.') }
}
export const COOKIE = '__Host-certo-titular'
const TX_COOKIE = '__Host-certo-titular-login'
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', signed: false, overwrite: true }
export function clearSession(ctx: any) {
  ctx.cookies.set(COOKIE, null, cookieOptions)
  ctx.cookies.set(TX_COOKIE, null, cookieOptions)
}
export function session(ctx: any): Session {
  const value = unseal(ctx.cookies.get(COOKIE, { signed: false }), config().key, 'session')
  if (!value.actor?.sub || typeof value.actor.email_verified !== 'boolean') return fail(401, 'Vuelve a entrar con tu cuenta.')
  return value
}
export function checkOrigin(ctx: any) {
  const origin = ctx.get('origin')
  // Navigations (including the OIDC callback) may omit Origin. Writes may not.
  if ((origin && origin !== config().origin)
    || (ctx.method !== 'GET' && (!origin || ctx.get('sec-fetch-site') === 'cross-site'))) {
    fail(403, 'Abre esta sección desde el portal para enviar tu solicitud.')
  }
}
function equal(a: unknown, b: unknown): boolean {
  return typeof a === 'string' && typeof b === 'string'
    && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
export function actorFromClaims(claims: any, nonce: string, client: string): Actor {
  if (!equal(claims.nonce, nonce) || (claims.azp !== undefined && claims.azp !== client)
    || (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== client)
    || typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 255
    || typeof claims.email !== 'string' || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    return fail(401, 'No se pudo comprobar tu cuenta. Vuelve a iniciar sesión.')
  }
  return { sub: claims.sub, email: claims.email, email_verified: claims.email_verified === true,
    name: (typeof claims.name === 'string' ? claims.name : typeof claims.preferred_username === 'string' ? claims.preferred_username : '').slice(0, 255) }
}
export async function startLogin(ctx: any) {
  const c = config()
  const tx = { state: random(), nonce: random(), verifier: random(), exp: Math.floor(Date.now() / 1000) + 300 }
  clearSession(ctx)
  ctx.cookies.set(TX_COOKIE, seal(tx, c.key, 'login'), { ...cookieOptions, maxAge: 300_000 })
  const url = new URL(`${c.issuer}/protocol/openid-connect/auth`)
  url.search = new URLSearchParams({ client_id: c.client, redirect_uri: c.callback, response_type: 'code',
    scope: 'openid email profile', state: tx.state, nonce: tx.nonce, code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(tx.verifier).digest('base64url') }).toString()
  ctx.redirect(url.href)
}
export async function finishLogin(ctx: any) {
  const c = config()
  const tx = unseal(ctx.cookies.get(TX_COOKIE, { signed: false }), c.key, 'login')
  ctx.cookies.set(TX_COOKIE, null, cookieOptions)
  if (!equal(ctx.query.state, tx.state) || typeof ctx.query.code !== 'string' || ctx.query.error) {
    return fail(401, 'No se completó el acceso. Vuelve a entrar con tu cuenta.')
  }
  const response = await fetch(`${c.internal}/protocol/openid-connect/token`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: ctx.query.code, redirect_uri: c.callback,
      client_id: c.client, client_secret: c.secret, code_verifier: tx.verifier }),
  })
  if (!response.ok) return fail(401, 'No se completó el acceso. Vuelve a entrar con tu cuenta.')
  const tokens: any = await response.json()
  // jose is already a backend dependency. Only asymmetric, signed ID tokens are accepted.
  const { jwtVerify, createRemoteJWKSet } = await import('jose')
  const keys = createRemoteJWKSet(new URL(`${c.internal}/protocol/openid-connect/certs`), { timeoutDuration: 10_000 })
  const { payload } = await jwtVerify(tokens.id_token, keys, { issuer: c.issuer, audience: c.client,
    algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'nonce'], maxTokenAge: '5m', clockTolerance: 5 })
  const actor = actorFromClaims(payload, tx.nonce, c.client)
  const exp = Math.min(payload.exp!, Math.floor(Date.now() / 1000) + 3600)
  ctx.cookies.set(COOKIE, seal({ actor, exp }, c.key, 'session'), { ...cookieOptions, maxAge: (exp * 1000) - Date.now() })
  // No access/ID/refresh token, sub or email is placed in the return URL.
  ctx.redirect(`${c.origin}/saberes-previos`)
}
