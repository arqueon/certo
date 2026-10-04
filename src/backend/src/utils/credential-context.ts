/** Terms retained by Certo's JWS format but absent from the VC 2 / OB3 contexts.
 * Only new issuances use this context; historical signed documents stay intact.
 * This describes the existing JWS envelope, not an EdDSA RDF canonical proof.
 */
export const credentialContext = {
  issuanceDate: { '@id': 'https://www.w3.org/2018/credentials#issuanceDate', '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
  expirationDate: { '@id': 'https://www.w3.org/2018/credentials#expirationDate', '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
  Ed25519Signature2020: {
    '@id': 'https://w3id.org/security#Ed25519Signature2020',
    '@context': {
      id: '@id', type: '@type',
      created: { '@id': 'http://purl.org/dc/terms/created', '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
      verificationMethod: { '@id': 'https://w3id.org/security#verificationMethod', '@type': '@id' },
      proofPurpose: { '@id': 'https://w3id.org/security#proofPurpose', '@type': '@vocab' },
      assertionMethod: 'https://w3id.org/security#assertionMethod',
      jws: 'https://w3id.org/security#jws',
    },
  },
}
