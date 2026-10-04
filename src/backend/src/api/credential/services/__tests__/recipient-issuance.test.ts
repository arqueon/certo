import openBadge from '../open-badge'
import credentialService from '../credential'
import verification from '../verification'
import { normalizeResults } from '../../../../utils/ob3-results'
import { publicVerification } from '../holder-access'
import obContext from '../../../../utils/__tests__/fixtures/ob3-context.json'

const jsonld = require('jsonld')
const { contexts } = require('@digitalbazaar/credentials-context')
const loader = async (url: string) => {
  const document = url === 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json' ? obContext : contexts.get(url)
  if (!document) throw new Error(`Unpinned context: ${url}`)
  return { document, documentUrl: url, contextUrl: null }
}

async function fixture() {
  const { generateKeyPair } = await import('jose')
  const pair = await generateKeyPair('EdDSA')
  const record: any = {
    id: 1, credentialId: 'urn:uuid:00000000-0000-4000-8000-000000000001',
    name: 'Example', description: 'Fictional achievement', issuanceDate: '2026-10-03T12:00:00Z',
    recipient: { email: ' Person@Example.test ' }, issuer: { id: 3, name: 'Example issuer' },
    achievement: { id: 2, name: 'Example', description: 'Fictional achievement', creator: { id: 3 }, criteria: { narrative: 'Complete assessment' } },
    proof: [{ jws: 'provisional' }],
    awardedDate: '2026-09-01T00:00:00Z', expirationDate: '2030-10-03T12:00:00Z',
    statusList: { id: 1, statusPurpose: 'revocation' }, statusListIndex: 0,
    evidence: [{ id: 4, name: 'Example evidence', narrative: 'Fictional', genre: 'Assessment', audience: 'Verifier' }],
    ...normalizeResults([{ id: 'urn:criterion', name: 'Criterion', resultType: 'RubricCriterionLevel', rubricCriterionLevel: [{ id: 'urn:level', name: 'Passed', level: '1' }] }], [{ resultDescription: 'urn:criterion', achievedLevel: 'urn:level' }]),
  }
  record.achievement.alignment = [{ targetName: 'Example framework', targetUrl: 'https://example.test/framework', targetCode: 'C1' }]
  const services: any = {}
  const strapi: any = { entityService: { findOne: async () => record }, config: { get: () => 'https://issuer.example.test' }, service: (name: string) => services[name] }
  services['api::profile.issuer-keys'] = { getOrCreateKeyPair: async () => ({ ...pair, keyId: 'test-key' }), getPublicKey: async () => pair.publicKey }
  services['api::credential.credential'] = credentialService({ strapi })
  services['api::credential.open-badge'] = openBadge({ strapi })
  ;(global as any).strapi = strapi
  const vc = await services['api::credential.open-badge'].serializeCredential(1, true)
  record.signedCredential = vc
  record.proof = [vc.proof]
  return { record, vc, service: services['api::credential.open-badge'], pair }
}

describe('new issuance and historical signatures', () => {
  test('signs the full identifier without a plaintext email and verifies through both services', async () => {
    const { record, vc, pair, service } = await fixture()
    const { jwtVerify } = await import('jose')
    const { payload } = await jwtVerify(vc.proof.jws, pair.publicKey)
    expect(vc.credentialSubject.id).toBeUndefined()
    expect(JSON.stringify(vc).toLowerCase()).not.toContain('person@example.test')
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('person@example.test')
    expect(payload.credentialSubject).toEqual(vc.credentialSubject)
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
    for (const hidden of ['identityHash', 'salt', vc.proof.jws, 'signedCredential', 'mailto:']) expect(text).not.toContain(hidden)
    expect(vc.proof.jws).toBeDefined()
  })
})
