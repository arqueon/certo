jest.mock('../../../../utils/wallet-presentation', () => ({ verifyWalletPresentation: jest.fn(async (vp) => vp.holder) }))
jest.mock('../../../../utils/data-integrity', () => ({
  signCredential: jest.fn(async (_s, _i, vc) => ({ ...vc, proof: { type: 'DataIntegrityProof' } })),
  verifyCredentialStatus: jest.fn(), verifyDataIntegrity: jest.fn(), verificationLoader: jest.fn(),
}))
import walletOffer, { OFFER_UID, COPY_UID, exchangeHash } from '../wallet-offer'
import holderWallets, { WALLET_UID } from '../holder-wallets'

/** A new wallet waits for the holder's confirmation instead of being refused (7-oct-2026). */
function world() {
  const token = 'a'.repeat(43)
  const offer: any = { id: 9, ownerId: 1, status: 'pending', tokenHash: exchangeHash(token), challenge: 'c', domain: 'd',
    expiresAt: new Date(Date.now() + 600000).toISOString(), credential: { id: 3 }, addWallet: false }
  const tables: Record<string, any[]> = {
    [OFFER_UID]: [offer], [COPY_UID]: [],
    [WALLET_UID]: [{ id: 1, ownerId: 1, holderDid: 'did:key:old', addedAt: 'x', removedAt: null }],
  }
  const match = (row, where = {}) => Object.entries(where).every(([k, v]: any) => v === null ? row[k] == null : (typeof v === 'object' ? true : row[k] === v))
  const services: Record<string, any> = {}
  const strapi: any = {
    db: {
      transaction: async (fn) => fn(),
      query: (uid) => {
        const rows = tables[uid] || []
        return {
          findOne: async ({ where }) => (uid === 'api::credential.credential' ? { id: 3, revoked: false } : rows.find((r) => match(r, where)) || null),
          findMany: async ({ where }) => rows.filter((r) => match(r, where)),
          count: async ({ where }) => rows.filter((r) => match(r, where)).length,
          create: async ({ data }) => { rows.push({ id: rows.length + 50, ...data }); return data },
          update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
          updateMany: async ({ where, data }) => { const hit = rows.filter((r) => match(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length } },
        }
      },
    },
    service: (name) => services[name],
  }
  services['api::credential.holder-wallets'] = holderWallets({ strapi })
  services['api::credential.holder-access'] = { find: async () => ({ id: 3, recipient: { owner: { id: 1 } }, issuer: { id: 1 }, signedCredential: { credentialSubject: {} } }) }
  const service = walletOffer({ strapi })
  service.eligible = async () => true
  return { token, offer, tables, service }
}
const vp = (holder) => ({ verifiablePresentation: { holder } })

test('a new wallet gets 202 and waits; once approved it receives the credential and is added', async () => {
  const { token, offer, tables, service } = world()
  await expect(service.exchange(token, vp('did:key:new'), { client: 'web', clientOrigin: 'https://w.example' })).rejects.toMatchObject({ status: 202 })
  expect(offer).toMatchObject({ status: 'pending', pendingHolderDid: 'did:key:new', pendingClient: 'web' })
  await expect(service.exchange(token, vp('did:key:new'), { client: 'web', clientOrigin: 'https://w.example' })).rejects.toMatchObject({ status: 202 })
  expect(await service.decide(1, 9, true)).toBe(true)
  const result = await service.exchange(token, vp('did:key:new'), { client: 'web', clientOrigin: 'https://w.example' })
  expect(result.verifiablePresentation.verifiableCredential[0].credentialSubject.id).toBe('did:key:new')
  expect(offer.status).toBe('used')
  expect(tables[WALLET_UID].map((w) => [w.holderDid, w.client || null])).toEqual([['did:key:old', null], ['did:key:new', 'web']])
})

test('a second unknown wallet on the same offer is refused, and a refused offer is closed', async () => {
  const { token, offer, service } = world()
  await expect(service.exchange(token, vp('did:key:new'), { client: 'app', clientOrigin: null })).rejects.toMatchObject({ status: 202 })
  await expect(service.exchange(token, vp('did:key:intruder'), { client: 'app', clientOrigin: null })).rejects.toMatchObject({ status: 404 })
  expect(await service.decide(1, 9, false)).toBe(true)
  expect(offer.status).toBe('rejected')
  await expect(service.exchange(token, vp('did:key:new'), { client: 'app', clientOrigin: null })).rejects.toMatchObject({ status: 404 })
})
