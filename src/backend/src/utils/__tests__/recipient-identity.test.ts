import { createRecipientIdentity, emailIdentityHash, matchesRecipient } from '../recipient-identity'

describe('OB3 recipient identity', () => {
  test('cannot issue an empty recipient identity', () => {
    expect(() => createRecipientIdentity('  ')).toThrow('Recipient email is required')
  })
  test('matches the published 1EdTech SHA-256 vector, normalizing the email', () => {
    expect(emailIdentityHash(' JJefferson18@Example.com ', 'FleurDeSel')).toBe(
      'sha256$' + '658625b25ab3d75d613ca97d9a5a77f70e2192feca5557f4ad09a4d4f121f5fc')
  })
  test('uses a distinct 16-byte hex salt for each credential', () => {
    const a = createRecipientIdentity('person@example.test'), b = createRecipientIdentity('person@example.test')
    expect(a.salt).toMatch(/^[a-f0-9]{32}$/)
    expect(a.salt).not.toBe(b.salt)
    expect(a.identityHash).not.toBe(b.identityHash)
    expect(matchesRecipient({ identifier: [a] }, ' PERSON@example.test ')).toBe(true)
    expect(matchesRecipient({ identifier: [a] }, 'other@example.test')).toBe(false)
  })
  test('compares historical mailto identifiers with the same normalization', () => {
    expect(matchesRecipient({ id: 'mailto: Person@Example.test ' }, 'person@example.test')).toBe(true)
    expect(matchesRecipient({ id: 'mailto:person@example.test' }, 'other@example.test')).toBe(false)
    expect(matchesRecipient(null, 'person@example.test')).toBe(false)
  })
  test('does not treat another identity type or malformed hash as an email match', () => {
    const identity = createRecipientIdentity('person@example.test')
    for (const changed of [{ identityType: 'userName' }, { hashed: false }, { identityHash: 'bad' }]) {
      expect(matchesRecipient({ identifier: [{ ...identity, ...changed }] }, 'person@example.test')).toBe(false)
    }
  })
})
