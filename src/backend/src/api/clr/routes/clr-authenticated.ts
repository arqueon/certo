/**
 * Authenticated CLR routes -- creating a CLR is a gestor/institutional
 * action (in practice, called by the consola de gestores), same auth
 * pattern as POST /credentials/issue.
 */
export default {
  routes: [
    { method: 'GET', path: '/holder/clrs', handler: 'clr.mine', config: { auth: { strategies: ['users-permissions'], scope: ['api::credential.credential.find'] } } },
    {
      method: 'POST',
      path: '/clrs',
      handler: 'clr.create',
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
      },
    },
  ],
}
