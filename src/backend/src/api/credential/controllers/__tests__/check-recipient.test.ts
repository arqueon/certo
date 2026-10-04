import { createRecipientIdentity } from '../../../../utils/recipient-identity'
import rateLimit from '../../../../middlewares/rate-limit'
import routes from '../../routes/credential-public'

jest.mock('@strapi/strapi', () => ({ factories: { createCoreController: (_uid: string, factory: any) => factory } }))
jest.mock('../../../../monitoring/metrics', () => ({ credentialsRevokedTotal: { inc: jest.fn() } }))
jest.mock('../../services/channel-alerts/index', () => ({ channelAlerts: {} }))
import controllerFactory from '../credential'

function setup(record: any) {
  const find = jest.fn(async () => record)
  const strapi: any = { service: () => ({ find }) }
  const controller = (controllerFactory as any)({ strapi })
  const ctx: any = { params: { id: 'urn:uuid:test' }, request: { body: { email: ' Person@Example.test ' } },
    set: jest.fn(), notFound: jest.fn(message => ({ status: 404, message })), badRequest: jest.fn(() => ({ status: 400 })) }
  return { controller, ctx, find }
}
const hashed = () => ({ signedCredential: { credentialSubject: { identifier: [createRecipientIdentity('person@example.test')] } } })

describe('POST check-recipient', () => {
  test('is explicitly public', () => {
    expect(routes.routes).toContainEqual(expect.objectContaining({ method: 'POST', path: '/credentials/:id/check-recipient', config: { auth: false } }))
  })
  test('returns only a match boolean and does not use a changed profile email', async () => {
    const { controller, ctx } = setup({ ...hashed(), recipient: { email: 'changed@example.test' } })
    expect(await controller.checkRecipient(ctx)).toEqual({ matches: true })
    ctx.request.body.email = 'changed@example.test'
    expect(await controller.checkRecipient(ctx)).toEqual({ matches: false })
    expect(ctx.set).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
  test.each([
    { signedCredential: { credentialSubject: { id: 'mailto:PERSON@example.test' } }, recipient: { email: 'changed@example.test' } },
    { proof: [{ jws: 'legacy' }], recipient: { email: 'PERSON@example.test' } },
  ])('supports historical mailto with and without a snapshot', async record => {
    const { controller, ctx } = setup(record)
    expect(await controller.checkRecipient(ctx)).toEqual({ matches: true })
    ctx.request.body.email = 'other@example.test'
    expect(await controller.checkRecipient(ctx)).toEqual({ matches: false })
  })
  test('missing and disabled links return identical 404s after the same minimum delay', async () => {
    jest.useFakeTimers()
    try {
      for (const record of [null, { ...hashed(), publicLinkActive: false }]) {
        const { controller, ctx } = setup(record)
        let completed = false
        const promise = controller.checkRecipient(ctx).then(result => { completed = true; return result })
        await jest.advanceTimersByTimeAsync(74)
        expect(completed).toBe(false)
        await jest.advanceTimersByTimeAsync(1)
        expect(await promise).toEqual({ status: 404, message: 'Credential is not publicly available' })
      }
    } finally { jest.useRealTimers() }
  })
  test.each([null, {}, '', 'not-an-email', 'a'.repeat(321) + '@example.test'])('rejects invalid input before lookup: %j', async email => {
    const { controller, ctx, find } = setup(hashed()); ctx.request.body = { email }
    expect(await controller.checkRecipient(ctx)).toEqual({ status: 400 })
    expect(find).not.toHaveBeenCalled()
  })
  test('an unsigned record cannot be matched through profile data', async () => {
    const { controller, ctx } = setup({ recipient: { email: 'person@example.test' } })
    expect(await controller.checkRecipient(ctx)).toEqual({ matches: false })
  })
})

describe('recipient checks use the existing per-IP limiter', () => {
  test('shares the quota across credential IDs and ignores spoofed forwarding headers', async () => {
    const saved = { ...process.env }
    process.env.RATE_LIMIT_MAX = '2'
    process.env.RATE_LIMIT_WHITELIST = ''
    process.env.PORTAL_TITULAR_IP_SOURCE = 'socket'
    try {
      const middleware = rateLimit({}, { strapi: {} })
      const next = jest.fn()
      const context = (id: number, peer = '192.0.2.91'): any => ({
        request: { path: `/api/credentials/${id}/check-recipient`, header: { 'x-forwarded-for': `198.51.100.${id}` } },
        req: { socket: { remoteAddress: peer } }, set: jest.fn(),
      })
      await middleware(context(1), next)
      await middleware(context(2), next)
      const limited = context(3)
      await middleware(limited, next)
      expect(next).toHaveBeenCalledTimes(2)
      expect(limited.status).toBe(429)
      expect(limited.set).toHaveBeenCalledWith('Cache-Control', 'no-store')
      await middleware(context(4, '192.0.2.92'), next)
      expect(next).toHaveBeenCalledTimes(3)
    } finally { process.env = saved }
  })
})
