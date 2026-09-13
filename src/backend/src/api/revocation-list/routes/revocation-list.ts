/**
 * revocation-list router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::revocation-list.revocation-list', {
  config: {
    find: {
      middlewares: [],
    },
    // Public and unauthenticated: this is the URL every issued credential's
    // credentialStatus.statusListCredential points to (see open-badge.ts),
    // so any external verifier must be able to dereference it without an
    // account -- the same requirement the Bitstring Status List spec places
    // on it.
    findOne: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    create: {},
    update: {},
    delete: {},
  },
}) 