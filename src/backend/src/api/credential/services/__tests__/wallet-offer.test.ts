import walletOffer, { exchangeHash, walletFormat, offerLifetime, OFFER_UID, COPY_UID } from '../wallet-offer'
import { fixture } from './interop-fixture'
import rateLimit from '../../../../middlewares/rate-limit'

describe('private wallet offers', () => {
  test('allows only the new hashed Data Integrity format with shared status', async () => {
    const { record } = await fixture()
    expect(walletFormat(record)).toBe(true)
    expect(walletFormat({})).toBeFalsy()
    expect(walletFormat({ signedCredential: { ...record.signedCredential, proof: { jws: 'old' } } })).toBe(false)
    expect(walletFormat({ signedCredential: { ...record.signedCredential, credentialStatus: undefined } })).toBeFalsy()
  })
  test('persists only a hash of the capability, independent random challenges and a 10-minute expiry', async () => {
    const { strapi, record } = await fixture()
    record.recipient.owner = { id: 7 }
    const query = strapi.db.query, create = jest.fn().mockResolvedValue({ id: 1 })
    strapi.db.query = uid => uid === OFFER_UID ? { create } : query(uid)
    const service = walletOffer({ strapi })
    const first = await service.create(record), second = await service.create(record)
    const token = first.exchangeUrl.split('/').pop()!
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(create.mock.calls[0][0].data.tokenHash).toBe(exchangeHash(token))
    expect(JSON.stringify(create.mock.calls)).not.toContain(token)
    expect(first.exchangeUrl).not.toBe(second.exchangeUrl)
    expect(create.mock.calls[0][0].data.challenge).not.toBe(create.mock.calls[1][0].data.challenge)
    expect(Date.parse(first.expiresAt) - Date.now()).toBeGreaterThan(590000)
    const request = JSON.parse(new URL(first.walletUrl).searchParams.get('request')!)
    expect(request.protocols.vcapi).toBe(first.exchangeUrl)
    expect(first.qrContent).toBe(first.walletUrl)
    expect(first.deepLink).toMatch(/^dccrequest:\/\/request\?request=/)
  })
  test('rejects revoked and invalid signatures before creating an offer', async () => {
    const { strapi, record } = await fixture()
    const service = walletOffer({ strapi })
    record.revoked = true
    await expect(service.create(record)).rejects.toMatchObject({ status: 409 })
    record.revoked = false; record.signedCredential.name = 'Tampered'
    await expect(service.create(record)).rejects.toMatchObject({ status: 409 })
  })
  test.each([null, { status: 'used' }, { status: 'expired' }, { id: 1, status: 'pending', expiresAt: '2000-01-01', credential: { id: 1 } }])('unavailable offers have the same error: %j', async row => {
    const updateMany = jest.fn()
    const service = walletOffer({ strapi: { db: { query: () => ({ findOne: async () => row, updateMany }) } } })
    await expect(service.pending('a'.repeat(43))).rejects.toMatchObject({ status: 404, message: 'Exchange unavailable' })
    if (row?.status === 'pending') expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'expired' } }))
  })
  test('bounds the configurable lifetime', () => {
    const saved = process.env.WALLET_OFFER_TTL_SECONDS
    try {
      process.env.WALLET_OFFER_TTL_SECONDS = '120'; expect(offerLifetime()).toBe(120000)
      for (const bad of ['0', '-1', 'Infinity', '3601', 'x', '0.5']) {
        process.env.WALLET_OFFER_TTL_SECONDS = bad; expect(offerLifetime).toThrow()
      }
    } finally { if (saved === undefined) delete process.env.WALLET_OFFER_TTL_SECONDS; else process.env.WALLET_OFFER_TTL_SECONDS = saved }
  })
  test('counts distinct wallets, with only owner-facing copy metadata', async () => {
    const rows = [{ holderDid: 'did:key:a', boundAt: '2026-10-04' }, { holderDid: 'did:key:a', boundAt: '2026-10-05' }]
    const findMany = jest.fn().mockResolvedValue(rows)
    const service = walletOffer({ strapi: { db: { query: uid => { expect(uid).toBe(COPY_UID); return { findMany } } } } })
    service.eligible = async () => true
    expect(await service.summary({ id: 1 })).toMatchObject({ walletCount: 1, copies: rows, revocation: 'shared' })
    expect(findMany.mock.calls[0][0].select).not.toContain('signedCredential')
  })
  test('shares IP quota across exchange identifiers and does not trust forwarded headers', async () => {
    const saved = { ...process.env }
    Object.assign(process.env, { RATE_LIMIT_MAX: '2', RATE_LIMIT_WHITELIST: '', PORTAL_TITULAR_IP_SOURCE: 'socket' })
    try {
      const middleware = rateLimit({}, { strapi: {} }), next = jest.fn()
      const context = id => ({ request: { path: `/api/exchanges/${id}`, header: { 'x-forwarded-for': id } }, req: { socket: { remoteAddress: '192.0.2.117' } }, set: jest.fn() }) as any
      await middleware(context('one'), next); await middleware(context('two'), next)
      const blocked = context('three'); await middleware(blocked, next)
      expect(next).toHaveBeenCalledTimes(2); expect(blocked.status).toBe(429)
    } finally { process.env = saved }
  })
})
