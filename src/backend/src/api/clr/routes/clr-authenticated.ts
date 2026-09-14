/**
 * Authenticated CLR routes -- creating a CLR is a gestor/institutional
 * action (in practice, called by the consola de gestores), same auth
 * pattern as POST /credentials/issue.
 */
export default {
  routes: [
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
