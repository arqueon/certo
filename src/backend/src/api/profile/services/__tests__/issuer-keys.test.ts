import issuerKeysFactory from '../issuer-keys'

function createFakeStrapi() {
  const issuerKeys: any[] = []
  const profiles = new Map<number, any>([[1, { id: 1, did: null, publicKey: [] }]])
  let nextId = 1

  return {
    strapi: {
      config: { get: (_key: string, fallback: string) => fallback },
      db: {
        query: (contentType: string) => {
          if (contentType !== 'api::issuer-key.issuer-key') {
            throw new Error(`Unexpected content type: ${contentType}`)
          }
          return {
            findOne: async ({ where }: any) =>
              issuerKeys.find((k) => Object.entries(where).every(([key, value]) => k[key] === value)) || null,
            create: async ({ data }: any) => {
              const record = { id: nextId++, status: 'active', ...data }
              issuerKeys.push(record)
              return record
            },
            update: async ({ where, data }: any) => {
              const record = issuerKeys.find((k) => k.id === where.id)
              if (!record) return null
              Object.assign(record, data)
              return record
            },
          }
        },
      },
      entityService: {
        findOne: async (contentType: string, id: number) => {
          if (contentType !== 'api::profile.profile') throw new Error('unexpected content type')
          return profiles.get(id) || null
        },
        update: async (contentType: string, id: number, { data }: any) => {
          if (contentType !== 'api::profile.profile') throw new Error('unexpected content type')
          const profile = profiles.get(id)
          const updated = { ...profile, ...data }
          profiles.set(id, updated)
          return updated
        },
      },
    },
    profiles,
    issuerKeys,
  }
}

describe('issuer-keys service', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-prod'
  })

  it('generates and persists a keypair on first use', async () => {
    const { strapi, issuerKeys, profiles } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    const { privateKey, publicKeyJwk } = await service.getOrCreateKeyPair(1)

    expect(privateKey).toBeDefined()
    expect(publicKeyJwk).toMatchObject({ kty: 'OKP', crv: 'Ed25519' })
    expect(issuerKeys).toHaveLength(1)
    expect(profiles.get(1).publicKey).toHaveLength(1)
    expect(profiles.get(1).publicKey[0].publicKeyJwk).toEqual(publicKeyJwk)
  })

  it('returns the same keypair on subsequent calls (idempotent)', async () => {
    const { strapi, issuerKeys } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    const first = await service.getOrCreateKeyPair(1)
    const second = await service.getOrCreateKeyPair(1)

    expect(issuerKeys).toHaveLength(1) // no second key was created
    expect(second.publicKeyJwk).toEqual(first.publicKeyJwk)
  })

  it('the generated key can actually sign and verify a JWS', async () => {
    const { strapi } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)
    const { SignJWT, jwtVerify } = await import('jose')

    const { privateKey } = await service.getOrCreateKeyPair(1)
    const jws = await new SignJWT({ hello: 'world' }).setProtectedHeader({ alg: 'EdDSA' }).sign(privateKey)

    const publicKey = await service.getPublicKey(1)
    const { payload } = await jwtVerify(jws, publicKey as any)
    expect(payload.hello).toEqual('world')
  })

  it('getPublicKey returns null for an issuer with no key yet', async () => {
    const { strapi } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    expect(await service.getPublicKey(999)).toBeNull()
  })

  describe('rotateKeyPair', () => {
    it('retires the old key (wiping its private key material) and activates a new one', async () => {
      const { strapi, issuerKeys, profiles } = createFakeStrapi()
      const service = issuerKeysFactory({ strapi } as any)

      const original = await service.getOrCreateKeyPair(1)
      const rotated = await service.rotateKeyPair(1, 'scheduled rotation')

      expect(issuerKeys).toHaveLength(2)
      const retired = issuerKeys.find((k) => k.id === original.keyId)
      expect(retired.status).toEqual('retired')
      expect(retired.retiredReason).toEqual('scheduled rotation')
      expect(retired.privateKeyEncrypted).toBeNull()
      // The retired key's public half is never wiped -- old credentials
      // must keep being verifiable.
      expect(retired.publicKeyJwk).toEqual(original.publicKeyJwk)

      const active = issuerKeys.find((k) => k.id === rotated.keyId)
      expect(active.status).toEqual('active')
      expect(rotated.publicKeyJwk).not.toEqual(original.publicKeyJwk)

      // Both keys stay listed on the profile (append-only mirror), so a
      // JWKS/issuer document consumer can still find the retired one.
      expect(profiles.get(1).publicKey).toHaveLength(2)
    })

    it('getOrCreateKeyPair returns the new active key, not the retired one, after rotation', async () => {
      const { strapi } = createFakeStrapi()
      const service = issuerKeysFactory({ strapi } as any)

      const original = await service.getOrCreateKeyPair(1)
      const rotated = await service.rotateKeyPair(1)
      const current = await service.getOrCreateKeyPair(1)

      expect(current.keyId).toEqual(rotated.keyId)
      expect(current.keyId).not.toEqual(original.keyId)
      expect(current.publicKeyJwk).toEqual(rotated.publicKeyJwk)
    })

    it('a credential signed before rotation can still be verified against its own (now-retired) key', async () => {
      const { strapi } = createFakeStrapi()
      const service = issuerKeysFactory({ strapi } as any)
      const { SignJWT, jwtVerify, importJWK } = await import('jose')

      const original = await service.getOrCreateKeyPair(1)
      const jws = await new SignJWT({ hello: 'world' }).setProtectedHeader({ alg: 'EdDSA' }).sign(original.privateKey)

      await service.rotateKeyPair(1, 'suspected compromise')

      // getPublicKey() now returns the *new* active key -- verifying
      // against it must fail; the credential's own retired public key
      // (kept on record) is what should still validate the old signature.
      const currentActivePublicKey = await service.getPublicKey(1)
      await expect(jwtVerify(jws, currentActivePublicKey as any)).rejects.toThrow()

      const retiredPublicKey = await importJWK(original.publicKeyJwk, 'EdDSA')
      const { payload } = await jwtVerify(jws, retiredPublicKey as any)
      expect(payload.hello).toEqual('world')
    })
  })
})
