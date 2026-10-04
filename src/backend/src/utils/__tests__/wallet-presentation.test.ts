import { verifyWalletPresentation, walletDocumentLoader, resolveWalletDidWeb } from '../wallet-presentation'
import { dataIntegritySuite } from '../data-integrity'

async function identity() {
  const { Ed25519VerificationKey2020 } = await import('@digitalcredentials/ed25519-verification-key-2020')
  const { driver } = await import('@digitalcredentials/did-method-key')
  const resolver = driver()
  resolver.use({ multibaseMultikeyHeader: 'z6Mk', fromMultibase: Ed25519VerificationKey2020.from })
  const key = await Ed25519VerificationKey2020.generate()
  const { didDocument } = await resolver.fromKeyPair({ verificationKeyPair: key })
  key.id = didDocument.authentication[0]; key.controller = didDocument.id
  return { controller: didDocument, key }
}
async function presentation(identity, overrides: any = {}, dataIntegrity = false) {
  const { default: jsigs } = await import('jsonld-signatures')
  const { Ed25519Signature2020 } = await import('@digitalcredentials/ed25519-signature-2020')
  return jsigs.sign({ '@context': ['https://www.w3.org/ns/credentials/v2', 'https://w3id.org/security/suites/ed25519-2020/v1'],
    type: ['VerifiablePresentation'], holder: overrides.holder || identity.controller.id }, {
    suite: dataIntegrity ? await dataIntegritySuite({ ...identity.key.signer(), algorithm: 'Ed25519' }) : new Ed25519Signature2020({ key: identity.key }),
    purpose: new jsigs.purposes.AuthenticationProofPurpose({ challenge: 'one-use', domain: 'issuer.example.test', ...overrides }),
    documentLoader: await walletDocumentLoader(identity.controller),
  })
}
describe('wallet authentication', () => {
  test('verifies LCW Ed25519Signature2020 with did:key and no HTTP', async () => {
    const wallet = await identity()
    const vp = await presentation(wallet)
    const fetcher = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network forbidden'))
    try {
      expect(await verifyWalletPresentation(vp, 'one-use', 'issuer.example.test')).toBe(wallet.controller.id)
      expect(fetcher).not.toHaveBeenCalled()
    } finally { fetcher.mockRestore() }
  })
  test('also accepts eddsa-rdfc-2022 authentication', async () => {
    const wallet = await identity()
    expect(await verifyWalletPresentation(await presentation(wallet, {}, true), 'one-use', 'issuer.example.test')).toBe(wallet.controller.id)
  })
  test.each([{ challenge: 'wrong' }, { domain: 'wrong' }])('rejects signed mismatched options %j', async overrides => {
    await expect(verifyWalletPresentation(await presentation(await identity(), overrides), 'one-use', 'issuer.example.test')).rejects.toThrow()
  })
  test('rejects unsigned VP, tampering, and a different holder key', async () => {
    const wallet = await identity(), other = await identity()
    const vp = await presentation(wallet)
    await expect(verifyWalletPresentation({ ...vp, proof: undefined }, 'one-use', 'issuer.example.test')).rejects.toThrow()
    await expect(verifyWalletPresentation({ ...vp, holder: other.controller.id }, 'one-use', 'issuer.example.test')).rejects.toThrow()
    await expect(verifyWalletPresentation(await presentation(wallet, { holder: other.controller.id }), 'one-use', 'issuer.example.test')).rejects.toThrow()
    await expect(verifyWalletPresentation({ ...vp, proof: { ...vp.proof, proofValue: vp.proof.proofValue.slice(0, -3) + '111' } }, 'one-use', 'issuer.example.test')).rejects.toThrow()
    await expect(verifyWalletPresentation({ ...vp, proof: { ...vp.proof, proofPurpose: 'assertionMethod' } }, 'one-use', 'issuer.example.test')).rejects.toThrow()
    await expect(verifyWalletPresentation({ ...vp, '@context': [...vp['@context'], { holder: 'https://attacker.example/holder' }] }, 'one-use', 'issuer.example.test')).rejects.toThrow()
  })
  test('supports did:web authentication only when its document authorizes the holder key', async () => {
    const wallet = await identity()
    const did = 'did:web:wallet.example.test'
    wallet.key.id = `${did}#auth`; wallet.key.controller = did
    wallet.controller = { '@context': wallet.controller['@context'], id: did,
      verificationMethod: [wallet.key.export({ publicKey: true })], authentication: [wallet.key.id] }
    const vp = await presentation(wallet)
    const resolver = jest.fn().mockResolvedValue(wallet.controller)
    expect(await verifyWalletPresentation(vp, 'one-use', 'issuer.example.test', resolver)).toBe(did)
    expect(resolver).toHaveBeenCalledWith(did)
    await expect(verifyWalletPresentation(vp, 'one-use', 'issuer.example.test', async () => ({ ...wallet.controller, authentication: [] }))).rejects.toThrow()
  })
  test('public did:web resolver refuses loopback and unsafe URL components', async () => {
    for (const did of ['did:web:127.0.0.1', 'did:web:10.0.0.1', 'did:web:user%40example.com', 'did:web:example.com%3A8080']) {
      await expect(resolveWalletDidWeb(did)).rejects.toThrow()
    }
  })
})
