import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** OB3 IdentityHash: UTF-8 identifier followed by the literal salt string. */
export function emailIdentityHash(email: string, salt: string): string {
  return `sha256$${createHash('sha256').update(normalizeEmail(email) + salt, 'utf8').digest('hex')}`
}

export function createRecipientIdentity(email: string) {
  if (typeof email !== 'string' || !normalizeEmail(email)) throw new Error('Recipient email is required for issuance')
  const salt = randomBytes(16).toString('hex')
  return { type: 'IdentityObject', identityType: 'emailAddress', hashed: true,
    identityHash: emailIdentityHash(email, salt), salt }
}

// Fixed-size digests avoid timingSafeEqual's unequal-length exception, including
// for historical mailto values. Never compare the submitted email directly.
function constantTimeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
  return timingSafeEqual(digest(a), digest(b))
}

export function matchesRecipient(subject: any, email: string): boolean {
  const identifiers = Array.isArray(subject?.identifier) ? subject.identifier : [subject?.identifier]
  let matches = false
  for (const identity of identifiers) {
    if (identity?.type !== 'IdentityObject' || identity.identityType !== 'emailAddress'
      || identity.hashed !== true || typeof identity.salt !== 'string'
      || !/^sha256\$[a-f0-9]{64}$/.test(identity.identityHash)) continue
    const match = constantTimeEqual(emailIdentityHash(email, identity.salt), identity.identityHash)
    matches = match || matches
  }
  const legacy = typeof subject?.id === 'string' && subject.id.startsWith('mailto:')
  const legacyMatch = constantTimeEqual(normalizeEmail(email), legacy ? normalizeEmail(subject.id.slice(7)) : '')
  return matches || (legacy && legacyMatch)
}
