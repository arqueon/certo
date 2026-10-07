import holderWallets, { WALLET_UID, walletKind } from '../holder-wallets'
import { COPY_UID, OFFER_UID } from '../wallet-offer'

/** In-memory stand-in for strapi.db.query over the three tables involved. */
function fakeStrapi({ wallets = [] as any[], offers = [] as any[], copies = [] as any[] } = {}) {
  let nextId = 100
  const matches = (row: any, where: any) => Object.entries(where || {}).every(([k, v]) => {
    if (k === 'offer') return (v as any).id.$in.includes(row.offer)
    if (v === null) return row[k] == null
    return row[k] === v
  })
  const tables: Record<string, any[]> = { [WALLET_UID]: wallets, [OFFER_UID]: offers, [COPY_UID]: copies }
  return {
    tables,
    db: { query: (uid: string) => {
      const rows = tables[uid]
      return {
        count: async ({ where }) => rows.filter((r) => matches(r, where)).length,
        findOne: async ({ where }) => rows.find((r) => matches(r, where)) || null,
        findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
        create: async ({ data }) => { const row = { id: nextId++, ...data }; rows.push(row); return row },
        update: async ({ where, data }) => { const row = rows.find((r) => r.id === where.id); Object.assign(row, data); return row },
      }
    } },
  }
}

describe('walletKind', () => {
  it('tells account wallets from device keys without exposing the DID', () => {
    expect(walletKind('did:webvh:Qm123:example.org')).toBe('account')
    expect(walletKind('did:web:example.org:u:1')).toBe('account')
    expect(walletKind('did:key:z6Mk')).toBe('device')
  })
})

describe('holder wallets admission', () => {
  it('admits the first wallet and marks it new', async () => {
    const strapi = fakeStrapi()
    expect(await holderWallets({ strapi }).admission({ ownerId: 1 }, 'did:key:a')).toEqual({ allowed: true, isNew: true })
  })
  it('refuses a wallet the holder did not add', async () => {
    const strapi = fakeStrapi({ wallets: [{ id: 1, ownerId: 1, holderDid: 'did:key:a', addedAt: 'x', removedAt: null }] })
    expect(await holderWallets({ strapi }).admission({ ownerId: 1 }, 'did:key:b')).toEqual({ allowed: false, isNew: false })
  })
  it('admits a new wallet when the offer was created to add one', async () => {
    const strapi = fakeStrapi({ wallets: [{ id: 1, ownerId: 1, holderDid: 'did:key:a', addedAt: 'x', removedAt: null }] })
    expect(await holderWallets({ strapi }).admission({ ownerId: 1, addWallet: true }, 'did:key:b')).toEqual({ allowed: true, isNew: true })
  })
  it('admits an added wallet again without re-adding it', async () => {
    const strapi = fakeStrapi({ wallets: [{ id: 1, ownerId: 1, holderDid: 'did:key:a', addedAt: 'x', removedAt: null }] })
    expect(await holderWallets({ strapi }).admission({ ownerId: 1 }, 'did:key:a')).toEqual({ allowed: true, isNew: false })
  })
  it('refuses a removed wallet unless it is added again', async () => {
    const strapi = fakeStrapi({ wallets: [
      { id: 1, ownerId: 1, holderDid: 'did:key:a', addedAt: 'x', removedAt: 'y' },
      { id: 2, ownerId: 1, holderDid: 'did:key:b', addedAt: 'x', removedAt: null },
    ] })
    expect((await holderWallets({ strapi }).admission({ ownerId: 1 }, 'did:key:a')).allowed).toBe(false)
  })
  it('backfills wallets from copies issued before tracking, so nobody is locked out', async () => {
    const strapi = fakeStrapi({
      offers: [{ id: 7, ownerId: 1, status: 'used' }],
      copies: [{ offer: 7, holderDid: 'did:key:old', boundAt: '2026-10-05T00:00:00Z' }],
    })
    const service = holderWallets({ strapi })
    expect(await service.admission({ ownerId: 1 }, 'did:key:old')).toEqual({ allowed: true, isNew: false })
    expect((await service.admission({ ownerId: 1 }, 'did:key:other')).allowed).toBe(false)
    expect(strapi.tables[WALLET_UID]).toHaveLength(1)
  })
})

describe('holder wallets list and removal', () => {
  it('lists kind, dates and counts, never the DID', async () => {
    const strapi = fakeStrapi({
      wallets: [{ id: 1, ownerId: 1, holderDid: 'did:webvh:Qm:x', addedAt: '2026-10-07', removedAt: null }],
      offers: [{ id: 7, ownerId: 1, status: 'used' }],
      copies: [{ offer: 7, holderDid: 'did:webvh:Qm:x', boundAt: '2026-10-07T10:00:00Z', credential: { id: 3 } }],
    })
    const list = await holderWallets({ strapi }).list(1)
    expect(list).toEqual([{ id: 1, kind: 'account', addedAt: '2026-10-07', credentials: 1, lastSavedAt: '2026-10-07T10:00:00Z' }])
    expect(JSON.stringify(list)).not.toContain('did:')
  })
  it('removes only the holder’s own wallet', async () => {
    const strapi = fakeStrapi({ wallets: [{ id: 1, ownerId: 1, holderDid: 'did:key:a', addedAt: 'x', removedAt: null }] })
    const service = holderWallets({ strapi })
    expect(await service.remove(2, 1)).toBe(false)
    expect(await service.remove(1, 1)).toBe(true)
    expect(strapi.tables[WALLET_UID][0].removedAt).toBeTruthy()
  })
})
