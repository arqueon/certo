import { isCredentialOwner } from '../services/holder-access'

export default {
  async offer(ctx) {
    ctx.set('Cache-Control', 'private, no-store')
    const credential = await strapi.service('api::credential.holder-access').find(ctx.params.id)
    if (!isCredentialOwner(credential, ctx.state.user?.id)) return ctx.forbidden('Only the holder may access this credential')
    try { return { data: await strapi.service('api::credential.wallet-offer').create(credential) } }
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
  async exchange(ctx) {
    ctx.set('Cache-Control', 'no-store')
    ctx.set('Referrer-Policy', 'no-referrer')
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
