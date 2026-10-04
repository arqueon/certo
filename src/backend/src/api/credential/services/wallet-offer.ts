import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { signCredential, verifyCredentialStatus, verifyDataIntegrity, verificationLoader } from '../../../utils/data-integrity'
import { issuerDid } from '../../../utils/issuer-did'
import { verifyWalletPresentation } from '../../../utils/wallet-presentation'

export const OFFER_UID = 'api::wallet-offer.wallet-offer'
export const COPY_UID = 'api::wallet-copy.wallet-copy'
export const exchangeHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const unavailable = () => Object.assign(new Error('Exchange unavailable'), { status: 404 })

export function walletFormat(credential: any): boolean {
  const vc = credential?.signedCredential
  return vc?.['@context']?.[0] === 'https://www.w3.org/ns/credentials/v2'
    && vc.proof?.type === 'DataIntegrityProof' && vc.proof?.cryptosuite === 'eddsa-rdfc-2022'
    && !!vc.credentialSubject?.identifier?.some(i => i.type === 'IdentityObject' && i.hashed === true && /^sha256\$[a-f0-9]{64}$/.test(i.identityHash))
    && vc.credentialStatus?.type === 'BitstringStatusListEntry' && vc.credentialStatus?.statusPurpose === 'revocation'
}

export function offerLifetime() {
  const seconds = Number(process.env.WALLET_OFFER_TTL_SECONDS ?? 600)
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3600) throw new Error('WALLET_OFFER_TTL_SECONDS must be 30..3600')
  return seconds * 1000
}

export default ({ strapi }) => ({
  async eligible(credential: any) {
    if (!walletFormat(credential)) return false
    const vc = credential.signedCredential
    if (credential.revoked || (vc.issuer?.id || vc.issuer) !== issuerDid(strapi)
      || (vc.validUntil && Date.parse(vc.validUntil) <= Date.now())
      || (vc.validFrom && Date.parse(vc.validFrom) > Date.now())) return false
    return (await verifyDataIntegrity(vc, await verificationLoader(strapi, vc))).valid
      && (await verifyCredentialStatus(strapi, vc)).valid
  },

  async create(credential: any) {
    if (!await this.eligible(credential)) throw Object.assign(new Error('Credential cannot be saved to a wallet'), { status: 409 })
    const base = new URL(process.env.PUBLIC_URL || strapi.config.get('server.url'))
    if (base.username || base.password || !['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid public URL')
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + offerLifetime()).toISOString()
    await strapi.db.query(OFFER_UID).create({ data: {
      tokenHash: exchangeHash(token), challenge: randomBytes(32).toString('base64url'),
      domain: base.host, expiresAt, status: 'pending', credential: credential.id,
      ownerId: credential.recipient.owner.id,
    } })
    const exchangeUrl = `${base.origin}/api/exchanges/${token}`
    const request = { protocols: { vcapi: exchangeUrl } }
    const encoded = encodeURIComponent(JSON.stringify(request))
    const walletUrl = `https://lcw.app/request.html?request=${encoded}`
    return { exchangeUrl, walletUrl, deepLink: `dccrequest://request?request=${encoded}`,
      interactionUrl: `${exchangeUrl}?iuv=1`, qrContent: walletUrl, expiresAt }
  },

  async pending(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw unavailable()
    const offer = await strapi.db.query(OFFER_UID).findOne({ where: { tokenHash: exchangeHash(token) }, populate: ['credential'] })
    if (!offer || offer.status !== 'pending') throw unavailable()
    if (Date.parse(offer.expiresAt) <= Date.now()) {
      await strapi.db.query(OFFER_UID).updateMany({ where: { id: offer.id, status: 'pending' }, data: { status: 'expired' } })
      throw unavailable()
    }
    if (!offer.credential) throw unavailable()
    return offer
  },

  async exchange(token: string, body: any) {
    const offer = await this.pending(token)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw unavailable()
    if (Object.keys(body).length === 0) return { verifiablePresentationRequest: {
      query: [{ type: 'DIDAuthentication', acceptedMethods: [{ method: 'key' }, { method: 'web' }] }],
      challenge: offer.challenge, domain: offer.domain,
    } }
    if (Object.keys(body).length !== 1 || !body.verifiablePresentation) throw unavailable()
    const holderDid = await verifyWalletPresentation(body.verifiablePresentation, offer.challenge, offer.domain)
    const credential = await strapi.service('api::credential.holder-access').find(String(offer.credential.id))
    if (!credential || String(credential.recipient?.owner?.id) !== String(offer.ownerId) || !await this.eligible(credential)) throw unavailable()
    const copy = structuredClone(credential.signedCredential)
    copy.id = `urn:uuid:${randomUUID()}`
    copy.credentialSubject.id = holderDid
    const signedCredential = await signCredential(strapi, credential.issuer.id, copy)
    // Compare-and-set inside a DB transaction, not a process-local lock.
    // Both callers may verify/sign, but only one can consume or receive a copy.
    await strapi.db.transaction(async () => {
      const result = await strapi.db.query(OFFER_UID).updateMany({
        where: { id: offer.id, status: 'pending', expiresAt: { $gt: new Date().toISOString() } },
        data: { status: 'used', usedAt: new Date().toISOString() },
      })
      if (result.count !== 1) throw unavailable()
      const latest = await strapi.db.query('api::credential.credential').findOne({ where: { id: credential.id } })
      if (!latest || latest.revoked) throw unavailable()
      await strapi.db.query(COPY_UID).create({ data: {
        credential: credential.id, offer: offer.id, holderDid, credentialId: copy.id,
        signedCredential, boundAt: new Date().toISOString(),
      } })
    })
    return { verifiablePresentation: {
      '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiablePresentation'],
      verifiableCredential: [signedCredential],
    } }
  },

  async summary(credential: any) {
    const rows = await strapi.db.query(COPY_UID).findMany({ where: { credential: credential.id }, orderBy: { boundAt: 'desc' },
      select: ['holderDid', 'boundAt', 'credentialId'] })
    return { eligible: await this.eligible(credential), legacy: !walletFormat(credential),
      walletCount: new Set(rows.map(row => row.holderDid)).size, copies: rows, revocation: 'shared' }
  },
})
