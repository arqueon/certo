/**
 * Public CLR routes -- unauthenticated, so any external verifier, wallet,
 * or the titular's own portal can dereference a CLR without an account
 * (same reasoning as credential-public.ts and revocation-list's public
 * findOne).
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/clrs/:id',
      handler: 'clr.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/clrs/:id/verify',
      handler: 'clr.verify',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}
