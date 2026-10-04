/** Exchange URLs are bearer capabilities. Never persist them in access logs. */
export default (_config, { strapi }) => async (ctx, next) => {
  const start = Date.now()
  await next()
  const url = /^\/api\/exchanges(?:\/|$)/.test(ctx.path) ? '/api/exchanges/[redacted]' : ctx.url
  strapi.log.http(`${ctx.method} ${url} (${Math.ceil(Date.now() - start)} ms) ${ctx.status}`)
}
