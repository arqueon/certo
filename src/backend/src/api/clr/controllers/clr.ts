/**
 * clr controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::clr.clr', ({ strapi }) => ({
  /**
   * Creates a new CLR grouping one or more already-issued credentials, and
   * returns the fully assembled, signed ClrCredential document (not just
   * the stored "recipe" row) so the caller (the consola de gestores, in
   * practice) has the real document to hand to the titular right away.
   *
   * Body: { data: { subjectId?, issuerId, credentialIds: number[], associations? } }
   */
  async create(ctx) {
    const { data } = ctx.request.body || {}
    if (!data) return ctx.badRequest('Missing required data')

    const { subjectId, issuerId, credentialIds, associations } = data
    if (!issuerId) return ctx.badRequest('issuerId es obligatorio')
    if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
      return ctx.badRequest('credentialIds debe ser un arreglo no vacío')
    }

    try {
      const clrService = strapi.service('api::clr.clr')
      const documento = await clrService.emitir({ subjectId, issuerId, credentialIds, associations })
      ctx.body = documento
    } catch (err: any) {
      strapi.log.error(`[clr.create] Error: ${err.message}`)
      return ctx.badRequest(err.message || 'Failed to create CLR')
    }
  },

  /**
   * Serves the assembled, signed ClrCredential JSON-LD document. Public
   * and unauthenticated -- an external verifier (or the titular's own
   * wallet/portal) must be able to dereference this without an account,
   * same reasoning as revocation-list's public findOne.
   */
  async findOne(ctx) {
    const { id } = ctx.params
    try {
      const clrService = strapi.service('api::clr.clr')
      const documento = await clrService.construirDocumento(id)
      if (!documento) return ctx.notFound('CLR not found')
      ctx.body = documento
    } catch (err: any) {
      strapi.log.error(`[clr.findOne] Error: ${err.message}`)
      return ctx.internalServerError('Error building CLR document')
    }
  },

  /**
   * Verifies the CLR's own signature (not each individual credential's --
   * those are already checked one by one via GET /api/credentials/:id/verify
   * and are included, proof and all, inside the CLR's achievement array).
   */
  async verify(ctx) {
    const { id } = ctx.params
    try {
      const clrService = strapi.service('api::clr.clr')
      const documento = await clrService.construirDocumento(id)
      if (!documento) return ctx.notFound('CLR not found')

      const { jwtVerify } = await import('jose')
      const issuerKeys = strapi.service('api::profile.issuer-keys')

      const clr: any = await strapi.entityService.findOne('api::clr.clr', id, { populate: ['issuer'] })
      const publicKey = await issuerKeys.getPublicKey(clr.issuer.id)

      if (!publicKey) {
        return { verified: false, message: 'Issuer has no signing key on record' }
      }

      try {
        await jwtVerify(documento.proof.jws, publicKey)
        return { verified: true, clr: documento }
      } catch (verifyError: any) {
        return { verified: false, message: `Signature verification failed: ${verifyError.message}` }
      }
    } catch (err: any) {
      strapi.log.error(`[clr.verify] Error: ${err.message}`)
      return ctx.internalServerError('Error verifying CLR')
    }
  },
}))
