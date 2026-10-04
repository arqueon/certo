export default {
  routes: [{ method: 'GET', path: '/issuer/did.json', handler: 'issuer-did.document',
    config: { auth: false, policies: [], middlewares: [] } }],
}
