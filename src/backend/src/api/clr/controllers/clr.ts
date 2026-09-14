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
   * Verifies the CLR: its own top-level signature, AND that none of the
   * credentials it groups has been revoked since. The Bitstring Status
   * List design deliberately never embeds a "revoked" flag in a credential
   * (that would force re-signing it on every status change) -- revocation
   * only shows up by dereferencing the separate status list. A CLR bundles
   * whole achievement objects, but a caller checking only the CLR's own
   * proof would miss that one of the achievements inside it was revoked
   * after the CLR was assembled -- so this checks each grouped credential's
   * current revoked flag directly, the same one GET
   * /api/credentials/:id/verify's own not_revoked check uses.
   */
  async verify(ctx) {
    const { id } = ctx.params
    try {
      const clrService = strapi.service('api::clr.clr')
      const documento = await clrService.construirDocumento(id)
      if (!documento) return ctx.notFound('CLR not found')

      const { jwtVerify } = await import('jose')
      const issuerKeys = strapi.service('api::profile.issuer-keys')

      const clr: any = await strapi.entityService.findOne('api::clr.clr', id, {
        populate: ['issuer', 'credentials'],
      })
      const publicKey = await issuerKeys.getPublicKey(clr.issuer.id)

      if (!publicKey) {
        return { verified: false, message: 'Issuer has no signing key on record' }
      }

      try {
        await jwtVerify(documento.proof.jws, publicKey)
      } catch (verifyError: any) {
        return { verified: false, message: `Signature verification failed: ${verifyError.message}` }
      }

      const revocadas = (clr.credentials || []).filter((c: any) => c.revoked)
      if (revocadas.length > 0) {
        return {
          verified: false,
          message: 'One or more grouped credentials have been revoked',
          revokedCredentials: revocadas.map((c: any) => ({
            credentialId: c.credentialId,
            reason: c.revocationReason || null,
          })),
        }
      }

      return { verified: true, clr: documento }
    } catch (err: any) {
      strapi.log.error(`[clr.verify] Error: ${err.message}`)
      return ctx.internalServerError('Error verifying CLR')
    }
  },
}))
