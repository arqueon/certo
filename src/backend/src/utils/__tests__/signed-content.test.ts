import { documentMismatches, storedCredentialMismatches } from '../signed-content'

const signed = {
  credentialId: 'urn:uuid:1',
  name: 'Datos abiertos',
  description: 'Analiza datos',
  achievement: 7,
  issuer: 9,
  awardedDate: '2025-11-14T00:00:00.000Z',
  result: [{ type: ['Result'], resultDescription: 'urn:c1', achievedLevel: 'urn:c1:n4' }],
}

describe('storedCredentialMismatches', () => {
  const stored = {
    credentialId: 'urn:uuid:1',
    name: 'Datos abiertos',
    description: 'Analiza datos',
    achievement: { id: 7 },
    issuer: { id: 9 },
    awardedDate: new Date('2025-11-14T00:00:00.000Z'),
    result: signed.result,
  }

  it('accepts a stored credential equal to what was signed', () => {
    expect(storedCredentialMismatches(signed, stored)).toEqual([])
  })

  it('catches a changed name or level after signing', () => {
    const tampered = { ...stored, name: 'Otro', result: [{ ...signed.result[0], achievedLevel: 'urn:c1:n1' }] }
    expect(storedCredentialMismatches(signed, tampered)).toEqual(['name', 'result'])
  })

  it('catches a field added after signing', () => {
    const { awardedDate, ...sinFecha } = signed
    expect(storedCredentialMismatches(sinFecha, stored)).toEqual(['awardedDate'])
  })
})

describe('documentMismatches', () => {
  const doc = {
    id: 'urn:uuid:1',
    name: 'Datos abiertos',
    description: 'Analiza datos',
    credentialSubject: { awardedDate: '2025-11-14T00:00:00.000Z', result: signed.result, achievement: {} },
  }

  it('accepts a document equal to the signed payload', () => {
    expect(documentMismatches(signed, doc)).toEqual([])
  })

  it('rejects a document whose name was changed', () => {
    expect(documentMismatches(signed, { ...doc, name: 'Credencial falsificada' })).toEqual(['name'])
  })

  it('does not judge payload shapes it does not know', () => {
    expect(documentMismatches({ foo: 1 }, doc)).toEqual([])
  })
})
