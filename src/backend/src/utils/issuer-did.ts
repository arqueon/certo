/** The host is configuration, never a request's Host/X-Forwarded-Host header. */
export function issuerDid(strapi: any): string {
  const configured = process.env.ISSUER_DID_WEB_HOST
  const url = new URL(configured ? `https://${configured}` : (
    process.env.PUBLIC_URL || process.env.NUXT_PUBLIC_WEBSITE_URL || strapi.config.get('server.url')
  ))
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || (configured && (url.pathname !== '/' || url.search || url.hash))) {
    throw new Error('ISSUER_DID_WEB_HOST must contain only a host (and optional port)')
  }
  return `did:web:${url.host.replace(/:/g, '%3A')}`
}

export function assertIssuerProfile(profileId: number | string) {
  if (process.env.ISSUER_DID_WEB_PROFILE_ID && String(profileId) !== process.env.ISSUER_DID_WEB_PROFILE_ID) {
    throw new Error('Issuer profile is not authorized for this did:web')
  }
}

export async function publicMultikey(did: string, key: { id: number | string; publicKeyJwk: any }) {
  const jwk = key.publicKeyJwk
  if (jwk?.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string'
    || Buffer.from(jwk.x, 'base64url').length !== 32) throw new Error('Invalid Ed25519 public JWK')
  const { fromJwk } = await import('@digitalbazaar/ed25519-multikey')
  // Explicit allowlist: even a malformed row carrying "d" cannot leak it.
  const pair = await fromJwk({ jwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x },
    id: `${did}#key-${key.id}`, controller: did })
  return pair.export({ publicKey: true, includeContext: true })
}

/** Read only: publishing a DID must never create a key or decrypt a secret. */
export async function issuerDidDocument(strapi: any) {
  const did = issuerDid(strapi)
  const keys = await strapi.db.query('api::issuer-key.issuer-key').findMany({
    where: { status: { $in: ['active', 'retired'] },
      ...(process.env.ISSUER_DID_WEB_PROFILE_ID ? { profile: process.env.ISSUER_DID_WEB_PROFILE_ID } : {}) },
    select: ['id', 'publicKeyJwk'], orderBy: { id: 'asc' },
  })
  const verificationMethod = await Promise.all(keys.map(key => publicMultikey(did, key)))
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did, verificationMethod,
    assertionMethod: verificationMethod.map(key => key.id),
    authentication: verificationMethod.map(key => key.id),
  }
}
