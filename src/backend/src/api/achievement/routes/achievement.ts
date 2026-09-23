/**
 * achievement router
 *
 * Las lecturas son públicas: el catálogo de achievements es información
 * pública y la página de verificación los necesita sin sesión.
 * Las escrituras exigen sesión y permiso del rol en users-permissions:
 * un achievement es la definición de lo que afirma cada credencial que
 * apunta a él, y la firma de la credencial no lo protege.
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::achievement.achievement', {
  config: {
    find: {
      auth: false
    },
    findOne: {
      auth: false
    }
  }
})
