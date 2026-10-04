/** Public evidence must not reveal a credential whose holder restricted it. */
import { factories } from '@strapi/strapi'

function visibilityFilter(ctx: any) {
  const visible: any[] = [
    { credential: { $null: true } },
    { credential: { publicLinkActive: { $ne: false }, publicRecipientName: { $ne: false } } },
  ]
  if (ctx.state.user) visible.push(
    { credential: { recipient: { owner: { id: ctx.state.user.id } } } },
    { credential: { issuer: { owner: { id: ctx.state.user.id } } } },
  )
  return { $or: visible }
}

export default factories.createCoreController('api::evidence.evidence', ({ strapi }) => ({
  async find(ctx) {
    await this.validateQuery(ctx)
    const query = await this.sanitizeQuery(ctx)
    const { results, pagination } = await strapi.service('api::evidence.evidence').find({
      ...query, filters: { $and: [query.filters || {}, visibilityFilter(ctx)] },
    })
    ctx.set('Cache-Control', 'no-store')
    return this.transformResponse(await this.sanitizeOutput(results, ctx), { pagination })
  },

  async findOne(ctx) {
    await this.validateQuery(ctx)
    const query = await this.sanitizeQuery(ctx)
    const { results } = await strapi.service('api::evidence.evidence').find({
      ...query,
      filters: { $and: [{ documentId: ctx.params.id }, visibilityFilter(ctx)] },
      pagination: { pageSize: 1 },
    })
    ctx.set('Cache-Control', 'no-store')
    if (!results.length) return ctx.notFound('Evidence is not publicly available')
    return this.transformResponse(await this.sanitizeOutput(results[0], ctx))
  },
}))
