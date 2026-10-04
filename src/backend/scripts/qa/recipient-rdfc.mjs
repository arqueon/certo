// Offline interoperability check on a fictional local QA export. Temporary
// Digital Bazaar dependencies live outside the repository (see portal docs).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const external = createRequire(resolve(process.argv[3], 'package.json'))
const load = name => import(external.resolve(name))
const { cryptosuite } = await load('@digitalbazaar/eddsa-rdfc-2022-cryptosuite')
const { DataIntegrityProof } = await load('@digitalbazaar/data-integrity')
const multikey = await load('@digitalbazaar/ed25519-multikey')
const { default: jsigs } = await load('jsonld-signatures')
const jsonld = require('jsonld')
const { contexts } = require('@digitalbazaar/credentials-context')
const obContext = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/utils/__tests__/fixtures/ob3-context.json', import.meta.url)), 'utf8'))
const original = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const docs = new Map(contexts)
docs.set('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json', obContext)
const documentLoader = async url => {
  if (!docs.has(url)) throw new Error(`Unpinned document: ${url}`)
  return { document: docs.get(url), documentUrl: url, contextUrl: null }
}
let count = 0
const check = (condition, message) => { assert.ok(condition, message); count++ }
const expanded = await jsonld.expand(original, { safe: true, documentLoader })
check(JSON.stringify(expanded).includes(original.credentialSubject.identifier[0].identityHash), 'full JWS export expands safely and retains identityHash')
const document = structuredClone(original)
delete document.proof
const controller = document.issuer.id
const key = await multikey.generate({ controller, id: `${controller}#rdfc-qa` })
const publicKey = await key.export({ publicKey: true, includeContext: true })
docs.set(publicKey.id, publicKey)
const controllerDocument = { id: controller, assertionMethod: [publicKey.id] }
const purpose = () => new jsigs.purposes.AssertionProofPurpose({ controller: controllerDocument })
const signed = await jsigs.sign(document, {
  suite: new DataIntegrityProof({ signer: key.signer(), cryptosuite }),
  purpose: purpose(), documentLoader,
})
const verify = vc => jsigs.verify(vc, { suite: new DataIntegrityProof({ cryptosuite }), purpose: purpose(), documentLoader })
check((await verify(signed)).verified, 'eddsa-rdfc-2022 roundtrip')
for (const field of ['identityHash', 'salt']) {
  const changed = structuredClone(signed)
  changed.credentialSubject.identifier[0][field] += '0'
  check(!(await verify(changed)).verified, `RDF signature rejects changed ${field}`)
}
const unknown = structuredClone(signed)
unknown.credentialSubject.undefinedRecipientTerm = 'must not be silently dropped'
await assert.rejects(jsonld.expand(unknown, { safe: true, documentLoader })); count++
check(!document.credentialSubject.id, 'subject ID is optional')
console.log(`RECIPIENT_RDFC_PASS ${count} assertions (offline, ephemeral key)`)
