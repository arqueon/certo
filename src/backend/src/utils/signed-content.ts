/**
 * Does the signed content match the document being verified?
 *
 * Data Integrity and recent JWS credentials sign the complete OB3 document.
 * Older credentials sign an internal summary (credentialId, name, results...). A
 * valid JWS only proves that payload was signed by the issuer. Unless the
 * payload is compared against the document shown or stored, anything outside
 * it can be changed - the name, the awarded date, the per-criterion results -
 * and verification would still say "valid". These helpers do that
 * comparison.
 *
 * Rule: every compared field must be equal on both sides; a field present in
 * the document but absent from the signed payload is a mismatch (it was
 * added after signing). Credentials signed before a field existed, and that
 * do not carry it either, still verify.
 */
import { isDeepStrictEqual } from 'node:util'
import { achievementClaims, subjectClaims } from './ob3-metadata'

function normalize(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.length ? `[${value.map(normalize).join(',')}]` : ''
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort()
    return `{${keys.map((k) => `${k}:${normalize((value as any)[k])}`).join(',')}}`
  }
  return String(value)
}

function differences(pairs: Record<string, [unknown, unknown]>): string[] {
  return Object.entries(pairs)
    .filter(([, [signed, shown]]) => normalize(signed) !== normalize(shown))
    .map(([field]) => field)
}

/** Stored credential (Strapi entity) against its signed payload. */
export function storedCredentialMismatches(payload: any, credential: any): string[] {
  if (payload?.credentialSubject && payload?.id) {
    const subject = payload.credentialSubject
    return [
      ...documentMismatches(payload, credential.signedCredential),
      ...differences({
        ...(credential.subjectMetadata0023 ? Object.fromEntries(Object.entries(subjectClaims(credential.subjectMetadata0023))
          .map(([key, value]) => [`subject.${key}`, [subject[key], value]])) : {}),
        ...(credential.achievementMetadata0023 ? Object.fromEntries(Object.entries(achievementClaims(credential.achievementMetadata0023, subject.achievement?.id, subject.achievement?.criteria))
          .map(([key, value]) => [`achievement.${key}`, [subject.achievement?.[key], value]])) : {}),
        credentialId: [payload.id, credential.credentialId],
        name: [payload.name, credential.name],
        description: [payload.description, credential.description],
        issuanceDate: [payload.validFrom || payload.issuanceDate, credential.issuanceDate],
        expirationDate: [payload.validUntil || payload.expirationDate, credential.expirationDate],
        awardedDate: [subject.awardedDate, credential.awardedDate],
        result: [subject.result, credential.result],
        resultDescription: [subject.achievement?.resultDescription, credential.resultDescription],
      }),
    ]
  }
  return differences({
    credentialId: [payload?.credentialId, credential?.credentialId],
    name: [payload?.name, credential?.name],
    description: [payload?.description, credential?.description],
    awardedDate: [payload?.awardedDate, credential?.awardedDate],
    result: [payload?.result, credential?.result],
    resultDescription: [payload?.resultDescription, credential?.resultDescription],
    achievement: [payload?.achievement, credential?.achievement?.id ?? credential?.achievement],
    issuer: [payload?.issuer, credential?.issuer?.id ?? credential?.issuer],
  })
}

/**
 * Open Badges document against a signed payload. Understands Certo's own
 * full document, legacy payload (credentialId...) and VC-JWT ({ vc: {...} }). For any
 * other payload shape it cannot tell, and returns no mismatches.
 */
export function documentMismatches(payload: any, vc: any): string[] {
  if (payload?.credentialSubject && payload?.id) {
    const { proof: _proof, ...document } = vc || {}
    return isDeepStrictEqual(payload, JSON.parse(JSON.stringify(document))) ? [] : ['document']
  }
  const subject = vc?.credentialSubject || {}
  if (payload && 'credentialId' in payload) {
    return differences({
      id: [payload.credentialId, vc?.id],
      name: [payload.name, vc?.name],
      description: [payload.description, vc?.description],
      awardedDate: [payload.awardedDate, subject.awardedDate],
      result: [payload.result, subject.result],
      resultDescription: [payload.resultDescription, subject.achievement?.resultDescription],
    })
  }
  if (payload?.vc) {
    return differences({
      id: [payload.vc.id, vc?.id],
      credentialSubject: [payload.vc.credentialSubject, vc?.credentialSubject],
    })
  }
  return []
}
