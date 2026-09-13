/**
 * revocation-list controller
 */

import { factories } from '@strapi/strapi'

// @digitalbazaar/vc-bitstring-status-list is ESM-only; this backend compiles
// to CommonJS, so it's loaded with a dynamic import, same as this codebase
// already does for `jose` in credential.ts's generateProof().
const bitstringStatusList = () => import('@digitalbazaar/vc-bitstring-status-list')

interface Credential {
  id: any
  credentialId: string
  revoked: boolean
  revocationReason?: string
  issuer: {
    id: any
  }
}

interface RevocationList {
  id: any
  revokedCredentials: Record<string, { reason: string, date: string }>
  lastUpdated: Date
}

export default factories.createCoreController('api::revocation-list.revocation-list', ({ strapi }) => ({
  /**
   * Serves the status list as an actual, signed `BitstringStatusListCredential`
   * (https://www.w3.org/TR/vc-bitstring-status-list/) instead of the raw
   * Strapi entity -- this is the URL `credentialStatus.statusListCredential`
   * points to on every issued credential (see open-badge.ts), so an external
   * verifier needs a real, dereferenceable, spec-shaped VC document here, not
   * `{id, statusListCredential, statusPurpose, encodedList, ...}`.
   */
  async findOne(ctx) {
    const { id } = ctx.params
    const statusList = await strapi.entityService.findOne(
      'api::revocation-list.revocation-list',
      id,
      { populate: ['issuer'] }
    )

    if (!statusList) {
      return ctx.notFound('Status list not found')
    }

    const baseUrl = strapi.config.get('server.url', 'http://localhost:1337')
    const credentialId = `${baseUrl}/api/revocation-lists/${statusList.id}`
    const { createCredential, decodeList, VC_BSL_VC_V2_CONTEXT } = await bitstringStatusList()
    const list = await decodeList({ encodedList: statusList.encodedList })

    const credential: any = await createCredential({
      id: credentialId,
      list,
      statusPurpose: statusList.statusPurpose || 'revocation',
      context: VC_BSL_VC_V2_CONTEXT,
    })
    credential.issuer = statusList.issuer
      ? { id: `${baseUrl}/api/profiles/${statusList.issuer.id}/issuer` }
      : undefined
    credential.validFrom = (statusList.lastUpdated
      ? new Date(statusList.lastUpdated)
      : new Date()
    ).toISOString()

    if (statusList.issuer) {
      const credentialService = strapi.service('api::credential.credential')
      credential.proof = await credentialService.generateProof(statusList.issuer.id, credential)
    }

    ctx.body = credential
  },

  // Custom controller methods for revocation list
  async checkStatus(ctx) {
    try {
      const { credentialId } = ctx.params
      
      if (!credentialId) {
        return ctx.badRequest('Credential ID is required')
      }
      
      // Find the credential
      const credential = await strapi.db.query('api::credential.credential').findOne({
        where: { credentialId },
        populate: ['issuer']
      }) as Credential
      
      if (!credential) {
        return ctx.notFound('Credential not found')
      }
      
      // If revoked directly, return that status
      if (credential.revoked) {
        return {
          revoked: true,
          reason: credential.revocationReason || 'No reason provided'
        }
      }
      
      // Otherwise check the revocation lists for this issuer
      const revocationLists = await strapi.db.query('api::revocation-list.revocation-list').findMany({
        where: { issuer: credential.issuer.id },
        orderBy: { lastUpdated: 'desc' },
        limit: 1
      }) as RevocationList[]
      
      if (revocationLists.length === 0) {
        return { revoked: false }
      }
      
      const list = revocationLists[0]
      const revokedCredentials = list.revokedCredentials || {}
      
      if (revokedCredentials[credentialId]) {
        return {
          revoked: true,
          reason: revokedCredentials[credentialId].reason || 'No reason provided',
          date: revokedCredentials[credentialId].date
        }
      }
      
      return { revoked: false }
    } catch (err) {
      console.error('Error checking credential status:', err)
      return ctx.internalServerError('Error checking credential status')
    }
  }
})) 