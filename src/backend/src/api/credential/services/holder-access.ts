/** Holder access never inherits the legacy null-owner exception for issuers. */
export const isCredentialOwner = (credential: any, userId: unknown): boolean =>
  userId != null && credential?.recipient?.owner?.id != null
  && String(credential.recipient.owner.id) === String(userId)

export const isPublicCredential = (credential: any): boolean =>
  !!credential && credential.publicLinkActive !== false

/** A display projection, never a replacement for the signed document. A JWS
 * contains the original payload, so hiding just recipient.name is insufficient. */
export function publicVerification(result: any) {
  const raw = result.rawCredential
  if (!isPublicCredential(raw)) return null
  const copy = JSON.parse(JSON.stringify(result))
  delete copy.rawCredential.signedCredential
  if (copy.rawCredential.recipient) {
    copy.rawCredential.recipient = { name: copy.rawCredential.recipient.name }
  }
  // El identificador del sujeto puede ser un correo (mailto:). La firma ya se
  // verificó en el servidor; la proyección pública nunca lo muestra.
  if (copy.credential?.credentialSubject) {
    delete copy.credential.credentialSubject.id
    delete copy.credential.credentialSubject.identifier
  }
  if (raw.publicRecipientName === false) {
    copy.recipientNameHidden = true
    copy.rawCredential.recipient = { name: 'Titular verificado por UDGPlus' }
    delete copy.rawCredential.proof
    delete copy.rawCredential.evidence
    delete copy.rawCredential.narrative
    delete copy.rawCredential.image
    if (copy.credential) {
      delete copy.credential.proof
      delete copy.credential.evidence
      copy.credential.credentialSubject = {
        type: copy.credential.credentialSubject?.type,
        achievement: copy.credential.credentialSubject?.achievement,
        result: copy.credential.credentialSubject?.result,
        awardedDate: copy.credential.credentialSubject?.awardedDate,
      }
      if (copy.credential.credentialSubject.achievement) {
        delete copy.credential.credentialSubject.achievement.evidence
      }
    }
  }
  return copy
}

export default ({ strapi }) => ({
  async find(identifier: string) {
    const filters = /^\d+$/.test(String(identifier))
      ? { id: Number(identifier) }
      : String(identifier).startsWith('urn:uuid:')
        ? { credentialId: identifier } : { documentId: identifier }
    const rows = await strapi.entityService.findMany('api::credential.credential', {
      filters,
      populate: ['recipient.owner', 'achievement.criteria', 'achievement.image', 'issuer.owner', 'proof'],
    })
    return rows[0] || null
  },
})
