/** Browser wallets get a narrowly scoped, cookie-free VC-API transport.
 * Native wallets need no Origin header. CORS is not exchange authorization. */
export default (config: { origins?: string[] }) => {
  const origins = new Set((config.origins || []).map(origin => origin.trim()).filter(origin => {
    try { return /^https?:/.test(origin) && new URL(origin).origin === origin } catch { return false }
  }))
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/api/exchanges/')) return next()
    ctx.vary('Origin')
    const origin = ctx.get('Origin')
    const allowed = origins.has(origin)
    if (ctx.method === 'OPTIONS') {
      ctx.vary('Access-Control-Request-Method')
      ctx.vary('Access-Control-Request-Headers')
      const headers = ctx.get('Access-Control-Request-Headers').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
      if (allowed && ctx.get('Access-Control-Request-Method') === 'POST' && headers.every(header => header === 'content-type')) {
        ctx.set('Access-Control-Allow-Origin', origin)
        ctx.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        ctx.set('Access-Control-Allow-Headers', 'Content-Type')
        ctx.status = 204
      } else ctx.status = 403
      return
    }
    try { await next() } finally {
      // Also remove Strapi's default headers on requests without Origin.
      ctx.remove('Access-Control-Allow-Credentials')
      ctx.remove('Access-Control-Allow-Origin')
      if (allowed && ctx.method === 'POST') ctx.set('Access-Control-Allow-Origin', origin)
    }
  }
}
