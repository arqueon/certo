jest.mock('../../services/wallet-landing', () => ({
  walletLanding: jest.fn(() => ({ html: '<main>landing</main>', csp: "default-src 'none'" })),
  wantsHtml: jest.fn((accepts: (...types: string[]) => string | false) => accepts('html', 'json') === 'html'),
}))
jest.mock('../../services/holder-wallets', () => ({ walletClient: jest.fn(() => ({ origin: null })) }))
import controller from '../wallet'

function setup(method: string, { iuv = '1', html = true }: { iuv?: string; html?: boolean } = {}) {
  const pending = jest.fn(async () => ({}))
  const exchange = jest.fn(async () => ({ verifiablePresentationRequest: {} }))
  ;(global as any).strapi = {
    service: () => ({ pending, exchange }),
    config: { get: () => 'https://issuer.test' },
  }
  const ctx: any = {
    method, params: { exchangeId: 'abc' }, query: iuv ? { iuv } : {}, request: { body: {} },
    status: 200, set: jest.fn(), vary: jest.fn(), get: jest.fn(() => ''),
    accepts: jest.fn((...types: string[]) => (html ? 'html' : 'json')),
  }
  return { ctx, pending, exchange }
}

describe('GET/HEAD on the interaction URL never consume the offer', () => {
  test.each(['GET', 'HEAD'])('%s with iuv=1 from a browser serves the landing page', async method => {
    const { ctx, pending, exchange } = setup(method)
    await (controller as any).exchange(ctx)
    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('text/html; charset=utf-8')
    expect(pending).toHaveBeenCalledWith('abc')
    expect(exchange).not.toHaveBeenCalled()
  })
  test.each(['GET', 'HEAD'])('%s with iuv=1 from a wallet returns the protocols map', async method => {
    const { ctx, exchange } = setup(method, { html: false })
    expect(await (controller as any).exchange(ctx)).toEqual({ protocols: { vcapi: 'https://issuer.test/api/exchanges/abc' } })
    expect(exchange).not.toHaveBeenCalled()
  })
  test.each(['GET', 'HEAD'])('%s without iuv=1 is a 404 and does not touch the exchange', async method => {
    const { ctx, pending, exchange } = setup(method, { iuv: '' })
    expect(await (controller as any).exchange(ctx)).toEqual({ error: { status: 404, message: 'Exchange unavailable' } })
    expect(ctx.status).toBe(404)
    expect(pending).not.toHaveBeenCalled()
    expect(exchange).not.toHaveBeenCalled()
  })
  test('POST still runs the exchange', async () => {
    const { ctx, exchange } = setup('POST', { iuv: '' })
    await (controller as any).exchange(ctx)
    expect(exchange).toHaveBeenCalledWith('abc', {}, { origin: null })
  })
})
