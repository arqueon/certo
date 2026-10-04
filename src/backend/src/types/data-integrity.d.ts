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
