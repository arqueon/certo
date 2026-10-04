import openBadge from '../open-badge'
import credentialService from '../credential'
import { normalizeResults } from '../../../../utils/ob3-results'
import { revocationListExtension } from '../../../revocation-list/services/revocation-list'

export async function fixture() {
  const { generateKeyPair, exportJWK } = await import('jose')
  const pair = await generateKeyPair('EdDSA')
  const record: any = {
    id: 1, credentialId: 'urn:uuid:00000000-0000-4000-8000-000000000001',
    name: 'Example', description: 'Fictional achievement', issuanceDate: '2026-10-03T12:00:00Z',
    recipient: { email: ' Person@Example.test ' }, issuer: { id: 3, name: 'Example issuer' },
    achievement: { id: 2, name: 'Example', description: 'Fictional achievement', creator: { id: 3 }, image: { url: 'https://issuer.example.test/badge.png' }, criteria: { narrative: 'Complete assessment', url: 'https://issuer.example.test/criteria' } },
    proof: [{ jws: 'provisional' }],
    awardedDate: '2026-09-01T00:00:00Z', expirationDate: '2030-10-03T12:00:00Z',
    statusList: { id: 1, statusPurpose: 'revocation' }, statusListIndex: 0,
    evidence: [{ id: 4, name: 'Example evidence', narrative: 'Fictional', genre: 'Assessment', audience: 'Verifier' }],
    ...normalizeResults([{ id: 'urn:criterion', name: 'Criterion', resultType: 'RubricCriterionLevel', rubricCriterionLevel: [{ id: 'urn:level', name: 'Passed', level: '1' }] }], [{ resultDescription: 'urn:criterion', achievedLevel: 'urn:level' }]),
  }
  record.achievement.alignment = [{ targetName: 'Example framework', targetUrl: 'https://example.test/framework', targetCode: 'C1' }]
  const services: any = {}
  const key = { id: 4, publicKeyJwk: await exportJWK(pair.publicKey) }
  const { createList } = await import('@digitalbazaar/vc-bitstring-status-list')
  const status = { id: 1, issuer: record.issuer, statusPurpose: 'revocation', lastUpdated: '2026-10-03T12:00:00Z', encodedList: await (await createList({ length: 131072 })).encode() }
  const keys = [key]
  const strapi: any = { db: { query: () => ({ findMany: async () => keys, findOne: async () => key }) }, entityService: { findOne: async (type: string) => type === 'api::revocation-list.revocation-list' ? status : record }, config: { get: () => 'https://issuer.example.test' }, service: (name: string) => services[name] }
  services['api::profile.issuer-keys'] = { getOrCreateKeyPair: async () => ({ ...pair, publicKeyJwk: key.publicKeyJwk, keyId: 4 }), getPublicKey: async () => pair.publicKey }
  services['api::credential.credential'] = credentialService({ strapi })
  services['api::credential.open-badge'] = openBadge({ strapi })
  services['api::revocation-list.revocation-list'] = revocationListExtension({ strapi })
  ;(global as any).strapi = strapi
  const vc = await services['api::credential.open-badge'].serializeCredential(1, true)
  record.signedCredential = vc
  record.proof = [vc.proof]
  return { record, vc, service: services['api::credential.open-badge'], pair, strapi, services, status, keys }
}
