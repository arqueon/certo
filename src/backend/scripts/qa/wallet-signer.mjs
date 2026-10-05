// Simulate LCW's composeVp with the standard DCC libraries, without a network.
import { Ed25519VerificationKey2020 } from '@digitalcredentials/ed25519-verification-key-2020'
import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020'
import { driver } from '@digitalcredentials/did-method-key'
import * as vc from '@digitalcredentials/vc'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { dataIntegritySuite } = require('../../dist/src/utils/data-integrity.js')
const { walletDocumentLoader } = require('../../dist/src/utils/wallet-presentation.js')

export async function wallet(dataIntegrity = false) {
  const resolver = driver()
  resolver.use({ multibaseMultikeyHeader: 'z6Mk', fromMultibase: Ed25519VerificationKey2020.from })
  const key = await Ed25519VerificationKey2020.generate()
  const { didDocument } = await resolver.fromKeyPair({ verificationKeyPair: key })
  key.id = didDocument.authentication[0]; key.controller = didDocument.id
  return { did: didDocument.id, didDocument,
    async sign({ challenge, domain }, holder = didDocument.id) {
      return vc.signPresentation({ presentation: vc.createPresentation({ holder }), challenge, domain,
        suite: dataIntegrity ? await dataIntegritySuite({ ...key.signer(), algorithm: 'Ed25519' }) : new Ed25519Signature2020({ key }), documentLoader: await walletDocumentLoader(didDocument) })
    },
  }
}
