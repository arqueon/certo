import { fixture } from './interop-fixture'
import verification from '../verification'
import { publicVerification } from '../holder-access'
import obContext from '../../../../utils/contexts/ob3-v3.0.3.json'

const jsonld = require('jsonld')
const { contexts } = require('@digitalbazaar/credentials-context')
const loader = async (url: string) => {
  const document = url === 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json' ? obContext : contexts.get(url)
  if (!document) throw new Error(`Unpinned context: ${url}`)
  return { document, documentUrl: url, contextUrl: null }
}


describe('new issuance and historical signatures', () => {
  test('a read/export never signs an old row with no saved signature', async () => {
    const { record, service } = await fixture()
    delete record.signedCredential
    record.proof = []
    await expect(service.serializeCredential(1)).rejects.toThrow('reissue it explicitly')
  })
  test('signs the full identifier without a plaintext email and verifies through both services', async () => {
    const { record, vc, pair, service } = await fixture()
    expect(vc.proof).toMatchObject({ type: 'DataIntegrityProof', cryptosuite: 'eddsa-rdfc-2022' })
    expect(vc.proof.jws).toBeUndefined()
    expect(vc.issuanceDate).toBeUndefined()
    expect(vc.expirationDate).toBeUndefined()
    expect(vc.validUntil).toBe(record.expirationDate)
    expect(vc.credentialSubject.id).toBeUndefined()
    expect(JSON.stringify(vc).toLowerCase()).not.toContain('person@example.test')
    expect(await verification.verifyProof(record)).toEqual({ valid: true })
    expect(await service.verifyExternalProof(vc)).toEqual({ valid: true })
    expect(await service.serializeCredential(1, true)).toEqual(vc)
    record.recipient.email = 'changed@example.test'
    expect(await service.serializeCredential(1)).toEqual(vc)
  })
  test.each(['identityHash', 'salt'])('rejects tampering with signed %s', async field => {
    const { record, vc, service } = await fixture()
    vc.credentialSubject.identifier[0][field] += '0'
    expect((await verification.verifyProof(record)).valid).toBe(false)
    expect((await service.verifyExternalProof(vc)).valid).toBe(false)
  })
  test('expands the complete signed JSON-LD in safe mode with no undefined terms', async () => {
    const { vc } = await fixture()
    const expanded = await jsonld.expand(vc, { documentLoader: loader, safe: true })
    expect(JSON.stringify(expanded)).toContain('https://purl.imsglobal.org/spec/vc/ob/vocab.html#identityHash')
    expect(JSON.stringify(expanded)).toContain(vc.credentialSubject.identifier[0].identityHash)
  })
  test('public projections never expose hash, salt or the decodable JWS', async () => {
    const { record, vc } = await fixture()
    const result = publicVerification({ rawCredential: record, credential: vc })
    const text = JSON.stringify(result)
    for (const hidden of ['identityHash', 'salt', vc.proof.proofValue, 'signedCredential', 'mailto:']) expect(text).not.toContain(hidden)
    expect(vc.proof.proofValue).toBeDefined()
  })
})
