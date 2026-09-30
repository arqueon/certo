/* Offline tests; dependencies resolved via NODE_PATH. Never loads Strapi or dotenv. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const { Readable } = require('node:stream')
const ts = require('typescript')
const sfc = require('@vue/compiler-sfc')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')
const root = path.resolve(__dirname, '..')
const failures = []
let count = 0
async function test(name, fn) {
  try { await fn(); count++; console.log(`OK ${name}`) }
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.message}`) }
}
function compile(source, filename) {
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.deepEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  return result.outputText
}
require.extensions['.ts'] = (mod, filename) => mod._compile(compile(fs.readFileSync(filename, 'utf8'), filename), filename)
const session = require('../src/backend/src/portal-titular/session.ts')
const contract = require('../src/backend/src/portal-titular/contract.ts')
const transport = require('../src/backend/src/portal-titular/transport.ts')
const logs = []
const middleware = require('../src/backend/src/middlewares/portal-titular.ts').default({}, { strapi: { log: { warn: value => logs.push(JSON.parse(value)) } } })
// Entirely synthetic credentials; no environment files or real service calls.
Object.assign(process.env, { PORTAL_TITULAR_IP_SOURCE: 'socket', PORTAL_TITULAR_TRUSTED_PROXY_IPS: '', PORTAL_TITULAR_ENABLED: 'true', PORTAL_TITULAR_PUBLIC_URL: 'https://portal.example.test',
  FRONTEND_URL: 'https://portal.example.test', KEYCLOAK_PUBLIC_URL: 'https://identity.example.test/realms/test',
  KEYCLOAK_INTERNAL_URL: 'https://identity-internal.example.test/realms/test', KEYCLOAK_CLIENT_ID: 'certo',
  KEYCLOAK_CLIENT_SECRET: 'synthetic-client-secret', PORTAL_TITULAR_SESSION_KEY: 'synthetic-cookie-key-for-offline-tests-only',
  PORTAL_TITULAR_HMAC_SECRET: 'a'.repeat(64), PORTAL_TITULAR_CONSOLA_URL: 'https://console.example.test' })
const actor = { sub: 'subject-stable-1', email: 'persona@example.test', email_verified: true, name: 'María Ejemplo' }
function ctx(target, method = 'GET', data, signedIn = true, headers = {}) {
  const u = new URL(target, process.env.PORTAL_TITULAR_PUBLIC_URL)
  const cookies = new Map()
  if (signedIn) cookies.set(session.COOKIE, session.seal({ actor, exp: Date.now() / 1000 + 300 }, session.config().key, 'session'))
  const requestHeaders = { origin: 'https://portal.example.test', 'content-type': 'application/json', ...headers }
  return { method, path: u.pathname, url: target, originalUrl: target, querystring: u.search.slice(1), query: Object.fromEntries(u.searchParams),
    req: Readable.from(data === undefined ? [] : [Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))]),
    get: k => requestHeaders[k.toLowerCase()] || '', responseHeaders: {},
    set(k, v) { this.responseHeaders[k] = v }, redirect(url) { this.location = url },
    cookies: { get: k => cookies.get(k), set(k, v, options) { assert.equal(options.secure, true); assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'lax'); if (v === null) cookies.delete(k); else cookies.set(k, v) } },
    cookieJar: cookies,
  }
}
const request = { method: 'POST', target: '/api/portal-titular/solicitudes-saberes', action: 'presentar', actor, ip: '203.0.113.10', idempotencyKey: 'synthetic-idem-0001',
  body: contract.bodyFor('presentar', { data: { nombreCompleto: 'María Ejemplo', claveLogro: 'FICHA-1', instancia: 'instance-1', descripcionSaberes: 'Sé organizar un proyecto.' } }) }
const realFetch = global.fetch
global.fetch = async () => { throw new Error('Unexpected network call in offline test') }
;(async () => {
  await test('allowlist covers the nine operations and rejects administrative paths and queries', () => {
    const pairs = [['GET', '/api/portal-titular/catalogo-publico'], ['GET', '/api/portal-titular/catalogo-publico/Ficha%20uno'], ['GET', '/api/portal-titular/instancias'],
      ['GET', '/api/portal-titular/solicitudes-saberes?pagina=2'], ['GET', '/api/portal-titular/solicitudes-saberes/11111111-1111-4111-8111-111111111111'], ['POST', '/api/portal-titular/solicitudes-saberes'],
      ...['subsanar', 'reapertura', 'confirmar-correo'].map(a => ['POST', `/api/portal-titular/solicitudes-saberes/11111111-1111-4111-8111-111111111111/${a}`])]
    for (const [m, p] of pairs) assert.ok(contract.route(m, p))
    for (const [m, p] of [['GET', '/api/portal-titular/solicitudes-saberes?revision=true'], ['GET', '/api/portal-titular/instancias?todas=true'],
      ['GET', '/api/portal-titular/solicitudes-saberes?pagina=1&pagina=2'], ['GET', '/api/portal-titular/solicitudes-saberes?pagina=01'],
      ['GET', '/api/portal-titular/catalogo-publico/..'], ['GET', '/api/portal-titular/catalogo-publico/%2Fadmin'], ['GET', '/api/portal-titular/catalogo-publico/%252Fadmin?populate=*'],
      ['POST', '/api/portal-titular/solicitudes-saberes/11111111-1111-4111-8111-111111111111/resolver'], ['DELETE', '/api/portal-titular/solicitudes-saberes/11111111-1111-4111-8111-111111111111'], ['GET', '/api/portal-titular/logros']]) {
      assert.throws(() => contract.route(m, p), e => e.status === 403)
    }
  })
  await test('browser identity, roles, filters and extra body fields cannot reach console', () => {
    for (const field of ['sub', 'email', 'email_verified', 'roles', 'actor', 'solicitanteSub', 'populate']) {
      assert.throws(() => contract.bodyFor('presentar', { data: { ...JSON.parse(request.body).data, [field]: 'forged' } }), e => e.status === 400)
    }
    assert.equal(contract.bodyFor('confirmar-correo', { data: {} }), '{"data":{}}')
    assert.throws(() => contract.bodyFor('reapertura', { data: { motivo: ' ' } }))
    assert.throws(() => contract.bodyFor('presentar', { data: { ...JSON.parse(request.body).data, fechaLogro: '2026-02-30' } }))
  })
  await test('signature independently verifies exact UTF-8 bytes, actor and canonical target', () => {
    const h = transport.sign(request, 'a'.repeat(64), '1790700000000', 'n'.repeat(43))
    const hash = crypto.createHash('sha256').update(request.body).digest('hex')
    const base = JSON.stringify(['1', 'portal-titular', 'POST', '/api/portal-titular/solicitudes-saberes', hash, '1790700000000', 'n'.repeat(43), h['X-UDG-Portal-Actor'], request.ip, request.idempotencyKey])
    assert.equal(h['X-UDG-Portal-Signature'], crypto.createHmac('sha256', 'a'.repeat(64)).update(base).digest('hex'))
    assert.deepEqual(JSON.parse(Buffer.from(h['X-UDG-Portal-Actor'], 'base64url')), actor)
    for (const modified of [{ ...request, method: 'GET' }, { ...request, target: request.target + '?pagina=1' },
      { ...request, body: request.body + ' ' }, { ...request, actor: { ...actor, email_verified: false } }]) {
      assert.notEqual(transport.sign(modified, 'a'.repeat(64), '1790700000000', 'n'.repeat(43))['X-UDG-Portal-Signature'], h['X-UDG-Portal-Signature'])
    }
  })
  await test('session encryption, expiry, wrong key and purpose fail closed', () => {
    const token = session.seal({ actor, exp: Date.now() / 1000 + 300 }, session.config().key, 'session')
    assert.deepEqual(session.unseal(token, session.config().key, 'session').actor, actor)
    assert.throws(() => session.unseal(token, 'wrong', 'session'))
    assert.throws(() => session.unseal(token, session.config().key, 'login'))
    assert.throws(() => session.unseal(session.seal({ exp: 1 }, session.config().key, 'session'), session.config().key, 'session'))
    assert.ok(!token.includes(actor.email))
  })
  await test('email_verified accepts only boolean true and claims require nonce/azp', () => {
    for (const value of [undefined, false, 'true', 1]) assert.equal(session.actorFromClaims({ ...actor, email_verified: value, nonce: 'n', aud: 'certo' }, 'n', 'certo').email_verified, false)
    assert.throws(() => session.actorFromClaims({ ...actor, nonce: 'bad' }, 'n', 'certo'))
    assert.throws(() => session.actorFromClaims({ ...actor, nonce: 'n', azp: 'other' }, 'n', 'certo'))
    assert.throws(() => session.actorFromClaims({ ...actor, nonce: 'n', aud: ['certo', 'other'] }, 'n', 'certo'))
  })
  await test('proxy requires SSO cookie even with forged Authorization/actor headers', async () => {
    const c = ctx('/api/portal-titular/instancias', 'GET', undefined, false, { authorization: 'Bearer forged', 'x-udg-actor-sub': 'admin' })
    await middleware(c, () => assert.fail('must not fall through')); assert.equal(c.status, 401)
  })
  await test('authenticated proxy signs cookie identity and never browser actor headers', async () => {
    const c = ctx('/api/portal-titular/instancias', 'GET', undefined, true,
      { 'x-udg-portal-actor': 'forged', 'x-udg-actor-sub': 'attacker', authorization: 'Bearer forged' })
    c.req.socket = { remoteAddress: '203.0.113.10' }
    let called = false
    global.fetch = async (_, options) => {
      called = true
      assert.deepEqual(JSON.parse(Buffer.from(options.headers['X-UDG-Portal-Actor'], 'base64url')), actor)
      assert.ok(!options.headers.authorization && !options.headers['x-udg-actor-sub'])
      return new Response(JSON.stringify({ data: [{ clave: 'CENTRO', nombre: 'Centro', activa: true, documentId: 'private' }] }))
    }
    await middleware(c, () => assert.fail('unexpected fallback'))
    assert.equal(c.status, 200); assert.ok(called); assert.ok(!JSON.stringify(c.body).includes('private'))
    global.fetch = async () => { throw new Error('Unexpected network call') }
  })
  await test('origin required on writes and same-origin session has no sub or tokens', async () => {
    const c = ctx('/api/portal-titular/solicitudes-saberes', 'POST', JSON.parse(request.body), true, { origin: 'https://evil.test' })
    await middleware(c, () => {}); assert.equal(c.status, 403)
    const own = ctx('/api/portal-titular/sesion'); await middleware(own, () => {})
    assert.deepEqual(own.body, { data: { nombre: actor.name, correo: actor.email, correoVerificado: true } })
    assert.equal(own.responseHeaders['Cache-Control'], 'no-store')
  })
  await test('GET rejects foreign Origin before session, login, callback or upstream; absent Origin permits navigation', async () => {
    for (const target of ['/sesion', '/auth/iniciar', '/auth/callback?code=PRIVATE&state=PRIVATE', '/instancias', '/solicitudes-saberes']) {
      for (const origin of ['https://evil.test', 'null', 'https://portal.example.test.evil.test']) {
        const c = ctx('/api/portal-titular' + target, 'GET', undefined, true, { origin })
        await middleware(c, () => assert.fail('unexpected fallback'))
        assert.equal(c.status, 403); assert.equal(c.location, undefined)
      }
    }
    for (const target of ['/sesion', '/auth/iniciar', '/auth/callback?code=invalid&state=invalid']) {
      const c = ctx('/api/portal-titular' + target, 'GET', undefined, true, { origin: '', 'sec-fetch-site': 'cross-site' })
      await middleware(c, () => {})
      assert.notEqual(c.status, 403)
      assert.ok(c.body || c.location)
    }
    for (const headers of [{ origin: '' }, { 'sec-fetch-site': 'cross-site' }]) {
      const c = ctx('/api/portal-titular/auth/salir', 'POST', { data: {} }, true, headers)
      await middleware(c, () => {}); assert.equal(c.status, 403)
    }
  })
  await test('frontend origin and API callback may use different HTTPS origins', () => {
    const previous = process.env.PORTAL_TITULAR_PUBLIC_URL
    try {
      process.env.PORTAL_TITULAR_PUBLIC_URL = 'https://api.example.test'
      assert.equal(session.config().origin, 'https://portal.example.test')
      assert.equal(session.config().callback, 'https://api.example.test/api/portal-titular/auth/callback')
      session.checkOrigin(ctx('/api/portal-titular/sesion'))
      assert.throws(() => session.checkOrigin(ctx('/api/portal-titular/sesion', 'GET', undefined, true, { origin: 'https://api.example.test' })))
    } finally { process.env.PORTAL_TITULAR_PUBLIC_URL = previous }
  })
  await test('IP source defaults to socket; CF and single XFF require trusted direct peer', () => {
    const { clientIp } = require('../src/backend/src/portal-titular/client-ip.ts')
    const headers = { 'cf-connecting-ip': '203.0.113.50', 'x-forwarded-for': '203.0.113.60' }
    const c = { req: { socket: { remoteAddress: '10.0.0.2' } }, ip: '192.0.2.99', get: k => headers[k] }
    try {
      delete process.env.PORTAL_TITULAR_IP_SOURCE
      process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = '10.0.0.2'
      assert.equal(clientIp(c), '10.0.0.2')
      for (const source of ['cf-connecting-ip', 'xff-single']) {
        process.env.PORTAL_TITULAR_IP_SOURCE = source
        const header = source === 'xff-single' ? 'x-forwarded-for' : source
        assert.equal(clientIp(c), headers[header])
        for (const invalid of ['', undefined, 'garbage', '1.1.1.1, 203.0.113.50', ['1.1.1.1'], ' 1.1.1.1', '1.1.1.1:80']) {
          assert.throws(() => clientIp({ ...c, get: k => k === header ? invalid : headers[k] }), e => e.status === 503)
        }
        assert.equal(clientIp({ ...c, get: () => '2001:db8::7' }), '2001:db8::7')
        process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = ''
        assert.equal(clientIp(c), '10.0.0.2')
        process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = '10.0.0.2'
      }
      process.env.PORTAL_TITULAR_IP_SOURCE = 'automatic'
      assert.throws(() => clientIp(c), e => e.status === 503)
      process.env.PORTAL_TITULAR_IP_SOURCE = 'xff-single'
      process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = '10.0.0.0/8'
      assert.throws(() => clientIp(c), e => e.status === 503)
      assert.throws(() => clientIp({ ...c, req: { socket: {} } }), e => e.status === 503)
    } finally { process.env.PORTAL_TITULAR_IP_SOURCE = 'socket'; process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = '' }
  })
  await test('early portal rate limit uses the same trusted source and cannot be bypassed with forged XFF', async () => {
    process.env.RATE_LIMIT_MAX = '1'; process.env.RATE_LIMIT_WHITELIST = ''; process.env.RATE_LIMIT_PATHS = ''
    const limit = require('../src/backend/src/middlewares/rate-limit.ts').default({}, { strapi: {} })
    function input(peer, headers) {
      const c = ctx('/api/portal-titular/auth/iniciar', 'GET', undefined, false, headers)
      c.req.socket = { remoteAddress: peer }; c.request = { path: c.path, header: headers, ip: '192.0.2.99' }
      return c
    }
    try {
      let passed = 0
      await limit(input('192.0.2.1', { 'x-forwarded-for': '203.0.113.1' }), () => { passed++ })
      const blocked = input('192.0.2.1', { 'x-forwarded-for': '203.0.113.2' })
      await limit(blocked, () => { passed++ }); assert.equal(blocked.status, 429); assert.equal(passed, 1)
      process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = '10.0.0.2'
      for (const [source, header, ip] of [['cf-connecting-ip', 'cf-connecting-ip', '203.0.113.3'], ['xff-single', 'x-forwarded-for', '203.0.113.4']]) {
        process.env.PORTAL_TITULAR_IP_SOURCE = source
        await limit(input('10.0.0.2', { [header]: ip }), () => { passed++ })
        const repeated = input('10.0.0.2', { [header]: ip })
        await limit(repeated, () => assert.fail('bypass')); assert.equal(repeated.status, 429)
        const invalid = input('10.0.0.2', { [header]: '1.1.1.1, 2.2.2.2' })
        await limit(invalid, () => assert.fail('bad header')); assert.equal(invalid.status, 503)
      }
      assert.equal(passed, 3)
    } finally {
      delete process.env.RATE_LIMIT_MAX
      process.env.PORTAL_TITULAR_IP_SOURCE = 'socket'; process.env.PORTAL_TITULAR_TRUSTED_PROXY_IPS = ''
    }
  })
  await test('502 logs contain only a route template, status and elapsed time', async () => {
    const fetchBefore = global.fetch
    try {
      for (const failure of [() => { throw new Error('PRIVATE network token') }, () => new Response('PRIVATE', { status: 500 }), () => new Response('PRIVATE malformed JSON')]) {
        global.fetch = async () => failure()
        const c = ctx('/api/portal-titular/catalogo-publico/PRIVATE-person')
        c.req.socket = { remoteAddress: '203.0.113.10' }
        const before = logs.length
        await middleware(c, () => {})
        assert.equal(c.status, 502); assert.equal(logs.length, before + 1)
        const entry = logs.at(-1)
        assert.deepEqual(Object.keys(entry).sort(), ['durationMs', 'path', 'status'])
        assert.equal(entry.path, '/api/portal-titular/catalogo-publico/:clave')
        assert.equal(entry.status, 502); assert.ok(entry.durationMs >= 0)
        assert.ok(!JSON.stringify(entry).includes('PRIVATE')); assert.ok(!JSON.stringify(c.body).includes('PRIVATE'))
      }
      const c = ctx('/api/portal-titular/solicitudes-saberes?pagina=12')
      c.req.socket = { remoteAddress: '203.0.113.10' }
      await middleware(c, () => {})
      assert.equal(logs.at(-1).path, '/api/portal-titular/solicitudes-saberes')
      const before = logs.length
      await middleware(ctx('/api/portal-titular/sesion', 'GET', undefined, false), () => {})
      assert.equal(logs.length, before)
    } finally { global.fetch = fetchBefore }
  })
  await test('Retry-After and idempotency constraints', async () => {
    await assert.rejects(transport.proxy({ ...request, idempotencyKey: undefined }), e => e.status === 400)
    await assert.rejects(transport.proxy({ ...request, method: 'GET', action: 'instancias', target: '/api/portal-titular/instancias', body: '' }), e => e.status === 400)
    await assert.rejects(transport.proxy(request, async () => new Response('', { status: 429, headers: { 'Retry-After': '42' } })), e => e.status === 429 && e.retryAfter === 42)
  })
  if (process.env.PORTAL_CONSOLE_SOURCE) await test('cross-check: actual console verifier accepts every signed operation', () => {
    const consumer = require(path.resolve(process.env.PORTAL_CONSOLE_SOURCE, 'backend/src/services/portal-seguridad.ts'))
    process.env.HMAC_ACTOR_SECRET = 'different-synthetic-management-key'
    const id = '11111111-1111-4111-8111-111111111111'
    const cases = [['GET','/instancias'], ['GET','/catalogo-publico'], ['GET','/catalogo-publico/Ficha%20uno'],
      ['GET','/solicitudes-saberes?pagina=2'], ['GET', '/solicitudes-saberes/' + id], ['POST','/solicitudes-saberes'],
      ...['subsanar','reapertura','confirmar-correo'].map(a => ['POST', '/solicitudes-saberes/' + id + '/' + a])]
    for (const [method, path] of cases) {
      const target = '/api/portal-titular' + path
      const req = { ...request, method, target, action: contract.route(method, target), body: method === 'GET' ? '' : request.body,
        idempotencyKey: path === '/solicitudes-saberes' && method === 'POST' ? request.idempotencyKey : undefined }
      const h = Object.fromEntries(Object.entries(transport.sign(req, process.env.PORTAL_TITULAR_HMAC_SECRET)).map(([k,v]) => [k.toLowerCase(),v]))
      h['content-type'] = 'application/json; charset=utf-8'
      const input = { method, originalUrl: target, request: { header: h, body: { [Symbol.for('unparsedBody')]: req.body } } }
      assert.equal(consumer.verificarPeticion(input).actor.sub, actor.sub)
      input.request.header['x-udg-portal-ip'] = '203.0.113.99'
      assert.throws(() => consumer.verificarPeticion(input))
    }
  })
  await test('HTTP and secret reuse are not accepted configuration', () => {
    assert.throws(() => session.httpsUrl('http://console.example.test'))
    assert.throws(() => session.httpsUrl('https://user:password@example.test'))
    const key = process.env.PORTAL_TITULAR_SESSION_KEY
    process.env.PORTAL_TITULAR_SESSION_KEY = process.env.PORTAL_TITULAR_HMAC_SECRET
    assert.throws(() => session.config()); process.env.PORTAL_TITULAR_SESSION_KEY = key
  })
  await test('transport sends signed body once, strips nonpublic response fields, rejects redirects', async () => {
    let calls = 0
    const response = await transport.proxy(request, async (url, options) => {
      calls++; assert.equal(url, 'https://console.example.test/api/portal-titular/solicitudes-saberes')
      assert.equal(options.body, request.body); assert.equal(options.redirect, 'error')
      assert.ok(!options.headers.Authorization && !options.headers.Cookie)
      return new Response(JSON.stringify({ data: { referencia: '11111111-1111-4111-8111-111111111111', estado: 'presentada', fundamentoDocumental: 'PRIVATE', cohorte: 'PRIVATE', logro: { clave: 'F1', nombre: 'Ficha' } } }), { status: 201 })
    })
    assert.equal(calls, 1); assert.equal(response.status, 201); assert.ok(!JSON.stringify(response.body).includes('PRIVATE'))
    let publicHeaders
    await transport.proxy({ ...request, method: 'GET', target: '/api/portal-titular/catalogo-publico', action: 'catalogo', body: '', idempotencyKey: undefined }, async (_, options) => {
      publicHeaders = options.headers; return new Response('{"data":[]}')
    })
    assert.equal(publicHeaders['X-UDG-Portal-Client'], 'portal-titular'); assert.ok(publicHeaders['X-UDG-Portal-Signature']); assert.ok(!publicHeaders['Idempotency-Key'])
  })
  await test('errors retain status and never expose upstream error text', async () => {
    for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
      await assert.rejects(transport.proxy(request, async () => new Response('PRIVATE', { status })), e => e.status === (status === 500 ? 502 : status) && !e.message.includes('PRIVATE'))
    }
  })
  await test('write body limits, malformed JSON, unsupported media types', async () => {
    const read = require('../src/backend/src/middlewares/portal-titular.ts').readBody
    await assert.rejects(read(ctx('/api/portal-titular/x', 'POST', '{')), e => e.status === 400)
    await assert.rejects(read(ctx('/api/portal-titular/x', 'POST', { data: {} }, true, { 'content-type': 'text/plain' })), e => e.status === 400)
    await assert.rejects(read(ctx('/api/portal-titular/x', 'POST', 'x'.repeat(65537))), e => e.status === 413)
  })
  await test('OIDC code flow uses state/nonce/PKCE and verifies signed ID token issuer/audience/expiry', async () => {
    const jose = require('jose')
    const { publicKey, privateKey } = await jose.generateKeyPair('RS256')
    const jwk = await jose.exportJWK(publicKey); jwk.kid = 'test-key'; jwk.alg = 'RS256'
    for (const variant of ['valid', 'issuer', 'audience', 'expiry', 'nonce', 'state', 'signature']) {
      const c = ctx('/api/portal-titular/auth/iniciar', 'GET', undefined, false)
      await session.startLogin(c)
      const login = new URL(c.location); assert.equal(login.searchParams.get('code_challenge_method'), 'S256')
      const nonce = login.searchParams.get('nonce')
      const claims = { ...actor, nonce: variant === 'nonce' ? 'wrong' : nonce }
      let key = privateKey
      if (variant === 'signature') key = (await jose.generateKeyPair('RS256')).privateKey
      const token = await new jose.SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(variant === 'issuer' ? 'https://evil.test' : session.config().issuer)
        .setAudience(variant === 'audience' ? 'other' : 'certo').setIssuedAt()
        .setExpirationTime(variant === 'expiry' ? Math.floor(Date.now() / 1000) - 60 : '5m').sign(key)
      c.query = { code: 'synthetic-code', state: variant === 'state' ? 'wrong' : login.searchParams.get('state') }
      global.fetch = async (url, options) => {
        if (String(url).endsWith('/token')) {
          assert.equal(crypto.createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), login.searchParams.get('code_challenge'))
          assert.equal(options.redirect, 'error'); return new Response(JSON.stringify({ id_token: token, access_token: 'never-store' }))
        }
        assert.ok(String(url).endsWith('/certs')); return new Response(JSON.stringify({ keys: [jwk] }))
      }
      if (variant === 'valid') {
        await session.finishLogin(c)
        assert.equal(c.location, 'https://portal.example.test/saberes-previos')
        assert.deepEqual(session.session(c).actor, actor)
      } else await assert.rejects(session.finishLogin(c))
    }
    global.fetch = async () => { throw new Error('Unexpected network call') }
  })
  // Compile real Vue SFCs, including their templates, without Nuxt installation.
  const vueFiles = ['src/frontend/app/pages/saberes-previos.vue', 'src/frontend/app/components/saberes/SolicitudTitular.vue', 'src/frontend/app/pages/dashboard.vue', 'src/frontend/app/components/Header.vue']
  for (const file of vueFiles) await test(`TypeScript and Vue template syntax: ${file}`, () => {
    const filename = path.join(root, file); const parsed = sfc.parse(fs.readFileSync(filename, 'utf8'), { filename })
    assert.deepEqual(parsed.errors, [])
    const script = sfc.compileScript(parsed.descriptor, { id: 'test', inlineTemplate: true })
    compile(script.content, filename + '.ts')
  })
  await test('SSR: negative response exposes only allowed actions, deadlines and wallet link', async () => {
    const filename = path.join(root, vueFiles[1]); const { descriptor } = sfc.parse(fs.readFileSync(filename, 'utf8'), { filename })
    let code = sfc.compileScript(descriptor, { id: 'ssr-test', inlineTemplate: true }).content
    code = code.replaceAll("'~/composables/useSaberesPrevios'", JSON.stringify(path.join(root, 'src/frontend/app/composables/useSaberesPrevios.ts')))
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths
    mod._compile('const {ref} = require("vue"); const useSaberesPrevios = () => ({request: async () => {throw new Error("unexpected SSR write")}});\n' + compile(code, filename + '.ts'), filename)
    async function html(extra) {
      const app = vue.createSSRApp(mod.exports.default, { solicitud: { referencia: 'never-display-this-id', estado: 'no_procede',
        createdAt: '2026-09-25T18:00:00Z', fechaLimite: '2026-10-09', descripcionSaberes: '<script>unsafe</script>',
        logro: { clave: 'technical-key', nombre: 'Trabajo en equipo' }, ...extra }, correoVerificado: true })
      app.component('NuxtLink', { props: ['to'], template: '<a :href="to"><slot /></a>' })
      return renderToString(app)
    }
    const first = await html({ subsanable: true, reaperturaUsada: false })
    assert.ok(first.includes('Completar solicitud') && first.includes('Pedir reapertura') && first.includes('9 de octubre de 2026'))
    assert.ok(!first.includes('never-display-this-id') && !first.includes('technical-key') && !first.includes('<script>unsafe'))
    const used = await html({ subsanable: false, reaperturaUsada: true })
    assert.ok(!used.includes('Completar solicitud') && !used.includes('Pedir reapertura') && used.includes('Presentar una solicitud nueva'))
    const recognized = await html({ estado: 'reconocida', estadoCredencial: 'emitida' })
    assert.ok(recognized.includes('/dashboard') && recognized.includes('Emitida'))
  })
  global.fetch = realFetch
  console.log(`\n${count} passed; ${failures.length} failed`)
  if (failures.length) process.exitCode = 1
})().catch(e => { global.fetch = realFetch; console.error(e.message); process.exitCode = 1 })
