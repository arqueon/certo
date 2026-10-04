import { isCredentialOwner, publicVerification } from '../../services/holder-access'
import createHolderAccess from '../../services/holder-access'
import openBadge from '../../services/open-badge'

jest.mock('@strapi/strapi', () => ({ factories: { createCoreController: (_uid: string, factory: any) => factory } }))
jest.mock('../../../../monitoring/metrics', () => ({ credentialsRevokedTotal: { inc: jest.fn() } }))
jest.mock('../../services/channel-alerts/index', () => ({ channelAlerts: {} }))
import controllerFactory from '../credential'
import clrFactory from '../../../clr/controllers/clr'

const record = () => ({
  id: 12, credentialId: 'urn:uuid:holder', publicRecipientName: true, publicLinkActive: true,
  recipient: { name: 'Private Person', email: 'private@example.test', owner: { id: 7 } },
  issuer: { id: 4 }, achievement: { creator: { id: 4 }, criteria: { narrative: 'Pass assessment', url: 'https://catalog.example.test/skill' } },
  proof: [{ jws: 'original.signature', type: 'Ed25519Signature2020' }],
})
function context(userId: number | null = 7, data: any = {}) {
  return { params: { id: 'urn:uuid:holder' }, state: { user: userId ? { id: userId } : null }, request: { body: { data } },
    set: jest.fn(), forbidden: jest.fn(() => ({ status: 403 })), notFound: jest.fn(() => ({ status: 404 })),
    badRequest: jest.fn(() => ({ status: 400 })), unauthorized: jest.fn(() => ({ status: 401 })) }
}
function setup(raw = record()) {
  const verification = { verified: true, rawCredential: raw, credential: { id: raw.credentialId, proof: raw.proof[0], credentialSubject: { id: 'mailto:private@example.test', name: raw.recipient.name, achievement: { name: 'Skill' } } } }
  const services: any = {
    'api::credential.holder-access': { find: jest.fn(async () => raw) },
    'api::credential.verification': { verifyCredential: jest.fn(async () => verification) },
    'api::credential.open-badge': { serializeCredential: jest.fn(async () => verification.credential), validateExternalCredential: jest.fn(async () => ({ verified: true })) },
    'api::credential.certificate': { generateCertificate: jest.fn() },
    'api::clr.clr': { construirDocumento: jest.fn(async () => ({ id: 'clr', proof: 'unchanged' })) },
  }
  const strapi: any = { service: (key: string) => services[key], entityService: {
    update: jest.fn(async (_uid, _id, args) => Object.assign(raw, args.data)),
    findOne: jest.fn(async () => ({ credentials: [raw] })), findMany: jest.fn(async () => []),
  } }
  ;(global as any).strapi = strapi
  return { raw, verification, services, strapi, controller: (controllerFactory as any)({ strapi }), clr: (clrFactory as any)({ strapi }) }
}

describe('holder privacy authorization and public surfaces', () => {
  test.each([null, 8, 4])('rejects privacy changes by user %s (anonymous, other holder or issuer)', async user => {
    const { controller, strapi } = setup()
    expect(await controller.privacy(context(user, { publicLinkActive: false }))).toEqual({ status: 403 })
    expect(strapi.entityService.update).not.toHaveBeenCalled()
  })
  test('unowned profiles are never holder-owned', () => {
    expect(isCredentialOwner({ recipient: { owner: null } }, 7)).toBe(false)
    expect(isCredentialOwner(null, 7)).toBe(false)
  })
  test('owner changes only booleans, without touching proof or snapshot', async () => {
    const { controller, raw, strapi } = setup()
    const proof = JSON.stringify(raw.proof)
    await controller.privacy(context(7, { publicRecipientName: false, publicLinkActive: false }))
    expect(raw.publicLinkActive).toBe(false)
    expect(JSON.stringify(raw.proof)).toBe(proof)
    expect(strapi.entityService.update).toHaveBeenCalledWith('api::credential.credential', 12, { data: { publicRecipientName: false, publicLinkActive: false } })
  })
  test.each([{ publicLinkActive: 'false' }, { recipient: 9 }, {}, { signedCredential: {} }])('rejects invalid or extra fields %j', async data => {
    const { controller, strapi } = setup()
    expect(await controller.privacy(context(7, data))).toEqual({ status: 400 })
    expect(strapi.entityService.update).not.toHaveBeenCalled()
  })
  test('core update cannot bypass holder privacy', async () => {
    const { controller } = setup()
    expect(await controller.update(context(4, { publicLinkActive: false }))).toEqual({ status: 400 })
  })
  test.each(['verify', 'findOne', 'getCertificate', 'getDirectCertificate'])('disabled link denies %s', async method => {
    const { controller, raw } = setup(); raw.publicLinkActive = false
    expect(await controller[method](context(null))).toEqual({ status: 404 })
  })
  test.each(['holder', 'export'])('only the owner may use %s even with a disabled public link', async method => {
    const { controller, raw } = setup(); raw.publicLinkActive = false
    expect(await controller[method](context(8))).toEqual({ status: 403 })
    expect(await controller[method](context(7))).not.toHaveProperty('status')
  })
  test('name hiding removes subject identity, proof payload and nested evidence without altering original', async () => {
    const { raw, verification } = setup(); raw.publicRecipientName = false
    const before = JSON.stringify(verification)
    const displayed = publicVerification(verification)
    expect(JSON.stringify(displayed)).not.toMatch(/Private Person|private@example|original.signature/)
    expect(displayed.rawCredential.recipient.name).toBe('Titular verificado por UDGPlus')
    expect(JSON.stringify(verification)).toBe(before)
  })
  test('legacy defaults remain public with visible holder name', () => {
    const { raw, verification } = setup(); delete raw.publicLinkActive; delete raw.publicRecipientName
    expect(publicVerification(verification).rawCredential.recipient.name).toBe('Private Person')
  })
  test('file verification is independent of link visibility', async () => {
    const { raw, controller, services } = setup(); raw.publicLinkActive = false
    const ctx: any = context(null); ctx.request.body = { credential: { id: raw.credentialId, proof: raw.proof } }
    expect(await controller.validate(ctx)).toEqual({ verified: true })
    expect(services['api::credential.open-badge'].validateExternalCredential).toHaveBeenCalledWith(ctx.request.body.credential)
  })
  test.each(['findOne', 'verify'])('public CLR %s cannot disclose restricted credentials', async method => {
    const { clr, raw, services } = setup(); raw.publicRecipientName = false
    expect(await clr[method](context(null))).toEqual({ status: 404 })
    expect(services['api::clr.clr'].construirDocumento).not.toHaveBeenCalled()
  })
  test('CLR history excludes any record containing credentials of another owner', async () => {
    const { clr, raw, strapi } = setup()
    strapi.entityService.findMany.mockResolvedValue([{ id: 1, credentials: [raw] }, { id: 2, credentials: [{ recipient: { owner: { id: 8 } } }] }])
    expect(await clr.mine(context(7))).toEqual({ data: [{ id: 'clr', proof: 'unchanged' }] })
    expect(strapi.entityService.findMany.mock.calls[0][1].filters).toEqual({ subject: { owner: { id: 7 } } })
  })
})

describe('OB3 criteria and immutable download', () => {
  test('new credentials include the catalog URL as criteria.id; legacy proofs keep their document shape', async () => {
    const raw: any = record()
    const service = openBadge({ strapi: { entityService: { findOne: async () => raw }, config: { get: () => 'https://issuer.example.test' }, service: () => ({ generateProof: async () => ({ jws: 'new.signature' }) }) } })
    const legacy = await service.serializeCredential(12)
    expect(legacy.credentialSubject.achievement.criteria).toEqual({ narrative: 'Pass assessment' })
    const issued = await service.serializeCredential(12, true)
    expect(issued.credentialSubject.achievement.criteria.id).toBe(raw.achievement.criteria.url)
    expect(legacy.proof.jws).toBe('original.signature')
    expect(issued.proof.jws).toBe('new.signature')
    raw.signedCredential = issued
    raw.achievement.criteria.url = 'https://changed.example.test'
    expect(await service.serializeCredential(12)).toEqual(issued)
  })
  test('lookup accepts URN, numeric and document ids and populates recipient.owner and criteria', async () => {
    const findMany = jest.fn(async () => [record()])
    const service = createHolderAccess({ strapi: { entityService: { findMany } } })
    for (const id of ['urn:uuid:holder', '12', 'document-id']) await service.find(id)
    expect(findMany.mock.calls.map((call: any) => call[1].filters)).toEqual([{ credentialId: 'urn:uuid:holder' }, { id: 12 }, { documentId: 'document-id' }])
  })
})
