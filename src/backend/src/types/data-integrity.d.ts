// These ESM libraries publish JavaScript through conditional exports without
// declarations. Keep the backend's existing CommonJS/Node resolution contract.
declare module '@digitalbazaar/data-integrity' {
  export const DataIntegrityProof: any
}
declare module '@digitalbazaar/eddsa-rdfc-2022-cryptosuite' {
  export const cryptosuite: any
}
declare module '@digitalbazaar/ed25519-multikey' {
  export const fromJwk: any
}

declare module '@digitalcredentials/did-method-key' { export const driver: any }
declare module '@digitalcredentials/ed25519-signature-2020' { export const Ed25519Signature2020: any }
declare module '@digitalcredentials/ed25519-verification-key-2020' { export const Ed25519VerificationKey2020: any }
