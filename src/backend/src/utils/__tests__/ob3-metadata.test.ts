import { normalizeAchievementMetadata as achievement, normalizeSubjectMetadata as subject, normalizeCriteria, issuerProfile } from '../ob3-metadata'
import contract from './fixtures/metadata-contract.json'
import { fixture } from '../../api/credential/services/__tests__/interop-fixture'
import { localDocumentLoader, verificationLoader, verifyDataIntegrity } from '../data-integrity'
import { storedCredentialMismatches } from '../signed-content'
import { publicVerification } from '../../api/credential/services/holder-access'

describe('contrato de metadatos 0023', () => {
  test('admite los objetos exactos del ejemplo y normaliza perfiles y criterios', () => {
    const a = achievement(contract.create.data.achievement)
    expect(a.creator.id).toBe('https://udgplus.udg.mx')
    expect(a.creator.parentOrg.id).toBe('https://www.udg.mx/')
    expect(a.criteria.id).toContain('?version=2')
    expect(a.alignment.map((a: any) => a.targetType)).toEqual(['ceasn:Competency', 'ext:QualificationLevel', 'ext:QualificationLevel'])
    expect(subject(contract.issue.data.subject).name).toBe('Persona de prueba')
  })
  test.each([null, [], 'a', 2, true])('rechaza objetos de tipo incorrecto: %p', value => {
    expect(() => achievement(value)).toThrow('achievement')
    expect(() => subject(value)).toThrow('subject')
  })
  test.each([
    { creditsAvailable: '2' }, { creditsAvailable: -1 }, { creditsAvailable: Infinity },
    { fieldOfStudy: 'a'.repeat(1001) }, { inLanguage: 'es español' }, { humanCode: 12 },
    { tag: [false] }, { tag: 'Curso' }, { alignment: [{}] }, { alignment: Array(101).fill({}) },
    { alignment: [{ targetName: 'Nivel', targetType: 'QualificationLevel' }] },
    { creator: { name: 'Instancia', url: 'http://example.org' } },
    { creator: { name: 'Instancia', id: 'did:web:example.org' } },
    { creator: { name: 'Instancia', url: 'https://user:pass@example.org' } },
    { creator: { name: 'Instancia', image: 'javascript:alert(1)' } },
    { creator: { name: 'Instancia', type: ['Profile', 'Injected'] } },
    { creator: { name: 'Instancia', parentOrg: { name: 'UdeG', parentOrg: {} } } },
    { criteria: { narrative: 4 } }, { criteria: { url: 'ftp://example.org' } },
    { criteria: { id: 'https://a.org', url: 'https://b.org' } },
  ])('rechaza logro inválido %j', value => expect(() => achievement(value)).toThrow('Metadatos:'))
  test.each([
    { name: '' }, { name: 'a'.repeat(501) }, { creditsEarned: '2' }, { term: [] },
    { activityStartDate: '2026-02-30T00:00:00Z' }, { activityEndDate: '2026-10-31' },
    { activityStartDate: '2026-10-31T00:00:00Z', activityEndDate: '2026-10-01T00:00:00Z' },
    { identifiers: [{}] }, { identifiers: 'CURP' }, { source: { name: 'Aliada', url: 'javascript:x' } },
  ])('rechaza sujeto inválido %j', value => expect(() => subject(value)).toThrow('Metadatos:'))
  test('opcionales y desconocidos no inyectan JSON-LD', () => {
    expect(achievement(undefined)).toBeUndefined()
    expect(subject({ identifiers: [], '@context': 'https://evil.test', unknown: 1 })).toEqual({})
    expect(achievement({ '@context': {}, creator: { name: 'Instancia', unknown: 1 } }).creator).not.toHaveProperty('unknown')
    expect(normalizeCriteria({})).toEqual({})
  })
  test('perfil sin sitio obtiene identidad URN estable', () => {
    expect(subject({ source: { name: 'Aliada' } }).source.id).toMatch(/^urn:certo:profile:[a-f0-9]{64}$/)
  })
  test('variables del emisor se validan', () => {
    const original = process.env.ISSUER_PROFILE_URL
    try {
      process.env.ISSUER_PROFILE_URL = 'http://example.org'
      expect(() => issuerProfile({ config: { get: () => 'https://test.org' } }, 'did:web:test.org')).toThrow('ISSUER_PROFILE_URL')
    } finally { if (original === undefined) delete process.env.ISSUER_PROFILE_URL; else process.env.ISSUER_PROFILE_URL = original }
  })
})
describe('serialización y privacidad 0023', () => {
  async function metadataFixture() {
    const f = await fixture()
    delete f.record.signedCredential
    f.record.achievementMetadata0023 = achievement(contract.issue.data.achievement)
    f.record.subjectMetadata0023 = subject(contract.issue.data.subject)
    const vc = await f.service.serializeCredential(1, true)
    f.record.signedCredential = vc
    return { ...f, vc }
  }
  test('firma todos los campos con JSON-LD seguro', async () => {
    const { vc, strapi } = await metadataFixture()
    expect(vc.credentialSubject.name).toBe('Persona de prueba')
    expect(vc.credentialSubject.identifier).toEqual(expect.arrayContaining([{ type: 'IdentityObject', identityType: 'name', hashed: false, identityHash: 'Persona de prueba' }]))
    expect(vc.credentialSubject.identifier[0].hashed).toBe(true)
    expect(vc.credentialSubject).not.toHaveProperty('tag')
    expect(vc.credentialSubject.narrative).toContain('Curso piloto UDG–ASU')
    expect(vc.credentialSubject.achievement.alignment.every((a: any) => a.targetUrl.endsWith('?version=2'))).toBe(true)
    expect(vc.issuer).toMatchObject({ name: 'Universidad de Guadalajara', address: { addressRegion: 'Jalisco', addressCountryCode: 'MX' } })
    await expect(require('jsonld').expand(vc, { safe: true, documentLoader: await localDocumentLoader() })).resolves.toBeDefined()
    expect(await verifyDataIntegrity(vc, await verificationLoader(strapi, vc))).toEqual({ valid: true })
    const altered = structuredClone(vc); altered.credentialSubject.term = '2027-A'
    expect((await verifyDataIntegrity(altered, await verificationLoader(strapi, altered))).valid).toBe(false)
  })
  test('instantánea se verifica y alterar la base deja de coincidir', async () => {
    const { vc, record } = await metadataFixture()
    const { proof, ...payload } = vc
    expect(storedCredentialMismatches(payload, record)).toEqual([])
    record.subjectMetadata0023.name = 'Otra persona'
    expect(storedCredentialMismatches(payload, record)).toContain('subject.name')
  })
  test('ocultar nombre limpia sus copias y conserva el resto', async () => {
    const { vc, record } = await metadataFixture()
    record.publicRecipientName = false
    const projection = publicVerification({ credential: vc, rawCredential: record })
    expect(JSON.stringify(projection)).not.toContain('Persona de prueba')
    expect(projection.credential.credentialSubject.term).toBe('2026-B')
    expect(projection.credential.credentialSubject.source.name).toBe('Arizona State University')
    expect(vc.credentialSubject.name).toBe('Persona de prueba')
    expect(projection.rawCredential).not.toHaveProperty('subjectMetadata0023')
  })
  test('sin criterios no firma relleno; original guardado permanece idéntico', async () => {
    const f = await fixture(); const original = structuredClone(f.vc)
    f.record.achievement.criteria = null
    expect(await f.service.serializeCredential(1)).toEqual(original)
    delete f.record.signedCredential
    expect((await f.service.serializeCredential(1, true)).credentialSubject.achievement.criteria).toEqual({})
  })
})
