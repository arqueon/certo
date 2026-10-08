/**
 * The wallets a holder added to receive copies of their credentials.
 *
 * A wallet joins in one of two ways, both from an offer the holder generated
 * in their own portal session: it is their first wallet, or the offer was
 * created with "add another wallet". Any other wallet that redeems an offer
 * is refused (decision of 7-oct-2026: several wallets per person, each added
 * by them). Removing a wallet stops new copies; copies already issued stay
 * valid, since copies share the original's revocation entry.
 */
import { COPY_UID, OFFER_UID } from './wallet-offer'

export const WALLET_UID = 'api::holder-wallet.holder-wallet'

/** What the portal can say about a wallet without showing its DID. */
export function walletKind(did: string): 'account' | 'device' {
  return /^did:(webvh|web):/.test(did) ? 'account' : 'device'
}

export interface WalletClient { client: 'web' | 'app'; clientOrigin: string | null }

/**
 * Which kind of wallet redeemed, from the request: a web wallet runs in a
 * browser, which sends its Origin on a cross-site POST; a native app sends
 * none. Lets "Mis carteras" say "web" or "app" instead of four identical rows.
 */
export function walletClient(origin?: string | null): WalletClient {
  try {
    const url = new URL(origin || '')
    if (url.protocol === 'https:' || url.protocol === 'http:') return { client: 'web', clientOrigin: url.origin }
  } catch {}
  return { client: 'app', clientOrigin: null }
}

/** The name the portal shows: the configured web wallet's name, or its host. */
export function walletName(client: string | null, clientOrigin: string | null, env = process.env): string | null {
  if (client !== 'web' || !clientOrigin) return null
  try { if (env.WALLET_APP_URL && new URL(env.WALLET_APP_URL).origin === clientOrigin && env.WALLET_APP_NAME) return env.WALLET_APP_NAME } catch {}
  return new URL(clientOrigin).host
}

export default ({ strapi }) => ({
  /**
   * Copies issued before wallets were tracked count as added wallets, so
   * enabling this does not lock anyone out. Runs once per holder: only when
   * the holder has no rows at all, removed ones included.
   */
  async backfill(ownerId: number) {
    const existing = await strapi.db.query(WALLET_UID).count({ where: { ownerId } })
    if (existing > 0) return
    const offers = await strapi.db.query(OFFER_UID).findMany({ where: { ownerId, status: 'used' }, select: ['id'] })
    if (!offers.length) return
    const copies = await strapi.db.query(COPY_UID).findMany({
      where: { offer: { id: { $in: offers.map((o) => o.id) } } }, select: ['holderDid', 'boundAt'], orderBy: { boundAt: 'asc' },
    })
    const first = new Map<string, string>()
    for (const copy of copies) if (!first.has(copy.holderDid)) first.set(copy.holderDid, copy.boundAt)
    for (const [holderDid, addedAt] of first) {
      await strapi.db.query(WALLET_UID).create({ data: { ownerId, holderDid, addedAt } })
    }
  },

  async active(ownerId: number) {
    await this.backfill(ownerId)
    return strapi.db.query(WALLET_UID).findMany({ where: { ownerId, removedAt: null }, orderBy: { addedAt: 'asc' } })
  },

  /** Whether this wallet may redeem the offer, and whether it is new. */
  async admission(offer: { ownerId: number; addWallet?: boolean; approvedHolderDid?: string | null }, holderDid: string) {
    const wallets = await this.active(offer.ownerId)
    if (wallets.some((w) => w.holderDid === holderDid)) return { allowed: true, isNew: false }
    // The holder confirmed this new wallet from their portal session.
    if (offer.addWallet || wallets.length === 0 || offer.approvedHolderDid === holderDid) return { allowed: true, isNew: true }
    return { allowed: false, isNew: false }
  },

  async add(ownerId: number, holderDid: string, client?: WalletClient) {
    const removed = await strapi.db.query(WALLET_UID).findOne({ where: { ownerId, holderDid } })
    if (removed) return strapi.db.query(WALLET_UID).update({ where: { id: removed.id }, data: { removedAt: null, addedAt: new Date().toISOString(), ...client } })
    return strapi.db.query(WALLET_UID).create({ data: { ownerId, holderDid, addedAt: new Date().toISOString(), ...client } })
  },

  /** Wallets added before the kind was recorded learn it on their next save. */
  async identify(ownerId: number, holderDid: string, client: WalletClient) {
    const wallet = await strapi.db.query(WALLET_UID).findOne({ where: { ownerId, holderDid, removedAt: null } })
    if (wallet && !wallet.client) await strapi.db.query(WALLET_UID).update({ where: { id: wallet.id }, data: client })
  },

  /** The portal's list: kind, web/app and name, dates and credential count. No DIDs. */
  async list(ownerId: number) {
    const wallets = await this.active(ownerId)
    const offers = await strapi.db.query(OFFER_UID).findMany({ where: { ownerId, status: 'used' }, select: ['id'] })
    const copies = offers.length ? await strapi.db.query(COPY_UID).findMany({
      where: { offer: { id: { $in: offers.map((o) => o.id) } } }, select: ['holderDid', 'boundAt'], populate: { credential: { select: ['id'] } },
    }) : []
    return wallets.map((w) => {
      const own = copies.filter((c) => c.holderDid === w.holderDid)
      return {
        id: w.id, kind: walletKind(w.holderDid), client: w.client || null,
        name: walletName(w.client || null, w.clientOrigin || null), addedAt: w.addedAt,
        credentials: new Set(own.map((c) => c.credential?.id)).size,
        lastSavedAt: own.map((c) => c.boundAt).sort().pop() || null,
      }
    })
  },

  async remove(ownerId: number, id: number) {
    const wallet = await strapi.db.query(WALLET_UID).findOne({ where: { id, ownerId, removedAt: null } })
    if (!wallet) return false
    await strapi.db.query(WALLET_UID).update({ where: { id }, data: { removedAt: new Date().toISOString() } })
    return true
  },
})
