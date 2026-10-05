/** The public well-known path already reaches Nuxt through the tunnel. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const base = String(config.issuerDidBackendUrl || config.public.apiUrl || '').replace(/\/$/, '')
  if (!base) throw createError({ statusCode: 503, statusMessage: 'DID backend URL is not configured' })
  const document = await $fetch(`${base}/api/issuer/did.json`, { timeout: 10000 })
  setResponseHeader(event, 'Content-Type', 'application/did+ld+json')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  // Web wallets and verifiers resolve did:web from the browser.
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  return document
})
