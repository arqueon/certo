/** Public verification documents (issuer DID document, Bitstring status
 * lists) must be readable from any browser origin: web wallets and
 * verifiers fetch them client-side. Read-only, never with credentials. */
const PUBLIC_PATHS = [/^\/api\/issuer\/did\.json$/, /^\/api\/revocation-lists\/[^/]+$/]

export default () => async (ctx, next) => {
  if (!PUBLIC_PATHS.some(path => path.test(ctx.path))) return next()
  if (ctx.method === 'OPTIONS') {
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    ctx.set('Access-Control-Allow-Headers', 'Accept')
    ctx.set('Access-Control-Max-Age', '600')
    ctx.status = 204
    return
  }
  try { await next() } finally {
    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      ctx.remove('Access-Control-Allow-Credentials')
      ctx.set('Access-Control-Allow-Origin', '*')
    }
  }
}
