import walletCors from '../wallet-cors'

const origin = 'https://wallet.example'
function context(path = '/api/exchanges/token', method = 'POST', source = origin, requestedMethod = 'POST', requestedHeaders = 'Content-Type') {
  const headers: Record<string, string> = {}
  const request = { Origin: source, 'Access-Control-Request-Method': requestedMethod, 'Access-Control-Request-Headers': requestedHeaders }
  return { path, method, status: 200, headers, get: (key: string) => request[key] || '',
    set: (key: string, value: string) => { headers[key] = value },
    remove: (key: string) => { delete headers[key] }, vary: jest.fn() }
}
const middleware = walletCors({ origins: [` ${origin} `, '*', 'null', 'https://bad.example/path'] })
test('wallet CORS is absent by default', async () => {
  const ctx = context()
  await walletCors({})(ctx, async () => {})
  expect(ctx.headers['Access-Control-Allow-Origin']).toBeUndefined()
})
test('limits JSON preflight to POST and content-type', async () => {
  const ctx = context(undefined, 'OPTIONS')
  const next = jest.fn()
  await middleware(ctx, next)
  expect(ctx.status).toBe(204)
  expect(ctx.headers).toEqual({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
  expect(next).not.toHaveBeenCalled()
})
test.each([
  ['https://evil.example', 'POST', 'Content-Type'], ['null', 'POST', 'Content-Type'],
  [origin, 'GET', 'Content-Type'], [origin, 'POST', 'Authorization'],
])('refuses unapproved preflight %s %s %s', async (source, method, headers) => {
  const ctx = context(undefined, 'OPTIONS', source, method, headers)
  await middleware(ctx, jest.fn())
  expect(ctx.status).toBe(403)
  expect(ctx.headers).toEqual({})
})
test.each(['/api/credentials', '/api/holder/credentials/a/wallet-offer', '/api/exchanges-extra/a'])('leaves other routes untouched: %s', async path => {
  const ctx = context(path), next = jest.fn()
  await middleware(ctx, next)
  expect(ctx.headers).toEqual({})
  expect(ctx.vary).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalled()
})
test.each(['POST', 'GET'])('cookie-free response including errors: %s', async method => {
  const ctx = context(undefined, method)
  await expect(middleware(ctx, async () => {
    ctx.set('Access-Control-Allow-Credentials', 'true')
    ctx.set('Access-Control-Allow-Origin', '*')
    throw new Error('error')
  })).rejects.toThrow('error')
  expect(ctx.headers['Access-Control-Allow-Credentials']).toBeUndefined()
  expect(ctx.headers['Access-Control-Allow-Origin']).toBe(method === 'POST' ? origin : undefined)
})
