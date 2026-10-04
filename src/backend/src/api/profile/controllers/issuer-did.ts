import { issuerDidDocument } from '../../../utils/issuer-did'

export default {
  async document(ctx) {
    ctx.set('Cache-Control', 'no-store')
    ctx.body = await issuerDidDocument(strapi)
    ctx.set('Content-Type', 'application/did+ld+json')
  },
}
