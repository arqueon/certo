/**
 * Comprehensive Learner Record (1EdTech CLR 2.0).
 *
 * A CLR wraps several already-issued OB3 AchievementCredentials under one
 * more signed document -- e.g. four microcredentials that together make up
 * a diploma. This service only stores the "recipe" (subject, issuer, which
 * credentials, how they relate); the actual signed JSON-LD document is
 * assembled fresh on every read (construirDocumento), exactly like
 * revocation-list assembles its BitstringStatusListCredential on every
 * GET -- so a CLR always reflects the current state (e.g. revoked/not) of
 * every credential it groups, instead of going stale the moment one of
 * them is revoked after the CLR was created.
 */

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Creates a new CLR "recipe". Validates that every credentialId given
   * actually exists and, if a subject was given, that each credential
   * really belongs to that subject -- a CLR grouping someone else's
   * credentials under the wrong learner's name would be worse than no CLR
   * at all.
   */
  async emitir({ subjectId, issuerId, credentialIds, associations }: {
    subjectId?: number | string
    issuerId: number | string
    credentialIds: Array<number | string>
    associations?: Array<{ source: string, target: string, type: string }>
  }) {
    if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
      throw new Error('credentialIds debe ser un arreglo no vacío')
    }
    if (!issuerId) {
      throw new Error('issuerId es obligatorio')
    }

    const credenciales = await strapi.entityService.findMany('api::credential.credential', {
      filters: { id: { $in: credentialIds } },
      populate: ['recipient'],
    })

    if (credenciales.length !== credentialIds.length) {
      throw new Error('Una o más credenciales no existen')
    }

    if (subjectId) {
      const ajenas = credenciales.filter((c: any) => String(c.recipient?.id) !== String(subjectId))
      if (ajenas.length > 0) {
        throw new Error('Alguna credencial no pertenece al titular indicado (subjectId)')
      }
    }

    const clr = await strapi.entityService.create('api::clr.clr', {
      data: {
        subject: subjectId || credenciales[0].recipient?.id,
        issuer: issuerId,
        credentials: credentialIds,
        associations: associations || [],
        issuanceDate: new Date(),
        publishedAt: new Date(),
      },
    })

    return this.construirDocumento(clr.id)
  },

  /**
   * Assembles and signs the actual ClrCredential JSON-LD document for a
   * stored CLR "recipe". Reuses credential.ts's generateProof (the same
   * signing path a single credential uses) and open-badge.ts's
   * serializeCredential for each grouped credential, so a CLR's achievement
   * array holds the exact same OB3 documents (each with its own proof) that
   * GET /api/credentials/:id/verify would return standalone.
   */
  async construirDocumento(clrId: number | string) {
    const clr: any = await strapi.entityService.findOne('api::clr.clr', clrId, {
      populate: ['subject', 'issuer', 'credentials'],
    })

    if (!clr) return null
    if (!clr.issuer) throw new Error('El CLR no tiene emisor asociado')

    const baseUrl = strapi.config.get('server.url', 'http://localhost:1337')
    const openBadgeService = strapi.service('api::credential.open-badge')

    const achievements = await Promise.all(
      clr.credentials.map((c: any) => openBadgeService.serializeCredential(c.id)),
    )

    const clrUrl = `${baseUrl}/api/clrs/${clr.id}`
    const documento: any = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/clr/v2p0/context.json',
      ],
      id: clrUrl,
      type: ['VerifiableCredential', 'ClrCredential'],
      issuer: {
        id: `${baseUrl}/api/profiles/${clr.issuer.id}/issuer`,
        type: ['Profile'],
        name: clr.issuer.name,
      },
      issuanceDate: clr.issuanceDate,
      validFrom: clr.issuanceDate,
      credentialSubject: {
        id: clr.subject?.email ? `mailto:${clr.subject.email}` : undefined,
        type: ['ClrSubject'],
        achievement: achievements,
      },
      ...(clr.associations && clr.associations.length > 0 ? { associations: clr.associations } : {}),
    }

    const credentialService = strapi.service('api::credential.credential')
    documento.proof = await credentialService.generateProof(clr.issuer.id, documento)

    return documento
  },
})
