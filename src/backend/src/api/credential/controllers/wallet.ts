import { isCredentialOwner } from '../services/holder-access'
import { walletLanding, wantsHtml } from '../services/wallet-landing'

export default {
  async offer(ctx) {
    ctx.set('Cache-Control', 'private, no-store')
    const credential = await strapi.service('api::credential.holder-access').find(ctx.params.id)
    if (!isCredentialOwner(credential, ctx.state.user?.id)) return ctx.forbidden('Only the holder may access this credential')
    const addWallet = ctx.request.body?.addWallet === true
    try { return { data: await strapi.service('api::credential.wallet-offer').create(credential, { addWallet }) } }
    catch (error) {
      if (error.status === 409) { ctx.status = 409; return { error: { status: 409, message: error.message } } }
      throw error
    }
  },
  async copies(ctx) {
    ctx.set('Cache-Control', 'private, no-store')
    const credential = await strapi.service('api::credential.holder-access').find(ctx.params.id)
    if (!isCredentialOwner(credential, ctx.state.user?.id)) return ctx.forbidden('Only the holder may access this credential')
    return { data: await strapi.service('api::credential.wallet-offer').summary(credential) }
  },
  async wallets(ctx) {
    ctx.set('Cache-Control', 'private, no-store')
    if (!ctx.state.user?.id) return ctx.unauthorized()
    return { data: await strapi.service('api::credential.holder-wallets').list(ctx.state.user.id) }
  },
  async removeWallet(ctx) {
    ctx.set('Cache-Control', 'private, no-store')
    if (!ctx.state.user?.id) return ctx.unauthorized()
    const id = Number(ctx.params.walletId)
    if (!Number.isInteger(id) || !await strapi.service('api::credential.holder-wallets').remove(ctx.state.user.id, id)) return ctx.notFound()
    ctx.status = 204
  },
  async exchange(ctx) {
    ctx.set('Cache-Control', 'no-store')
    ctx.set('Referrer-Policy', 'no-referrer')
    ctx.vary('Accept')
    // A browser opening the interaction URL (the portal's single QR, scanned
    // with the camera) gets a page with one button per wallet; wallets ask
    // for JSON and keep getting the protocols map.
    if (ctx.method === 'GET' && ctx.query.iuv === '1' && wantsHtml((...types) => ctx.accepts(...types))) {
      const base = new URL(process.env.PUBLIC_URL || strapi.config.get('server.url'))
      let available = true
      try { await strapi.service('api::credential.wallet-offer').pending(ctx.params.exchangeId) } catch { available = false }
      const { html, csp } = walletLanding({
        exchangeUrl: `${base.origin}/api/exchanges/${ctx.params.exchangeId}`,
        available,
        walletAppUrl: process.env.WALLET_APP_URL,
        walletAppName: process.env.WALLET_APP_NAME,
      })
      ctx.set('Content-Security-Policy', csp)
      ctx.status = available ? 200 : 404
      ctx.type = 'text/html; charset=utf-8'
      ctx.body = html
      return
    }
    try {
      const service = strapi.service('api::credential.wallet-offer')
      if (ctx.method === 'GET') {
        if (ctx.query.iuv !== '1') throw new Error('Invalid interaction')
        await service.pending(ctx.params.exchangeId)
        const base = new URL(process.env.PUBLIC_URL || strapi.config.get('server.url'))
        return { protocols: { vcapi: `${base.origin}/api/exchanges/${ctx.params.exchangeId}` } }
      }
      if (Buffer.byteLength(JSON.stringify(ctx.request.body || {})) > 16384) throw new Error('Invalid presentation')
      return await service.exchange(ctx.params.exchangeId, ctx.request.body || {})
    } catch {
      // Same envelope for unknown, expired, consumed and invalid presentations.
      ctx.status = 404
      return { error: { status: 404, message: 'Exchange unavailable' } }
    }
  },
}
