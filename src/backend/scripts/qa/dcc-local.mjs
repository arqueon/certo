// Used by Jest in a native Node process: the *same* VC, suite and status
// verifier versions used by verifier-core beta.11, with an offline loader.
import { readFileSync } from 'node:fs'
import { verifyCredential } from '@digitalcredentials/vc'
import { DataIntegrityProof } from '@digitalcredentials/data-integrity'
import { cryptosuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite'
import { checkStatus } from '@digitalcredentials/vc-bitstring-status-list'
import { contexts as vcContexts } from '@digitalbazaar/credentials-context'
import di from '@digitalbazaar/data-integrity-context'
import multikey from '@digitalbazaar/multikey-context'
import did from 'did-context'

const { credential, didDocument, statusList } = JSON.parse(readFileSync(0, 'utf8'))
const documents = new Map([...vcContexts, ...di.contexts, ...multikey.contexts, ...did.contexts])
documents.set('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
  JSON.parse(readFileSync(new URL('../../src/utils/contexts/ob3-v3.0.3.json', import.meta.url))))
documents.set(didDocument.id, didDocument)
for (const key of didDocument.verificationMethod) documents.set(key.id, key)
if (statusList) documents.set(statusList.id, statusList)
if (process.argv.includes('--core')) {
  // Exercise verifier-core's actual did:web resolver/HTTP loader without
  // network. Only transport is replaced; signature, status and schema checks
  // are its unmodified beta.11 implementations and bundled contexts.
  const host = decodeURIComponent(didDocument.id.slice('did:web:'.length))
  documents.set(`https://${host}/.well-known/did.json`, didDocument)
  documents.set('https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json',
    JSON.parse(readFileSync(new URL('../../src/utils/__tests__/fixtures/ob3-vc2-schema.json', import.meta.url))))
  globalThis.fetch = async input => {
    const url = typeof input === 'string' ? input : input.url || String(input)
    if (!documents.has(url)) throw new Error(`Network forbidden: ${url}`)
    return new Response(JSON.stringify(documents.get(url)), {
      headers: { 'content-type': 'application/json' }, status: 200,
    })
  }
  const { verifyCredential: verifyCore } = await import('@digitalcredentials/verifier-core')
  const result = await verifyCore({ credential, knownDIDRegistries: [] })
  console.log(JSON.stringify(result))
} else {
  globalThis.fetch = () => { throw new Error('Network is forbidden in offline DCC QA') }
  const result = await verifyCredential({ credential,
    suite: new DataIntegrityProof({ cryptosuite }), checkStatus,
    documentLoader: async url => {
      if (!documents.has(url)) throw new Error(`Offline document missing: ${url}`)
      return { document: structuredClone(documents.get(url)), documentUrl: url, contextUrl: null }
    },
  })
  console.log(JSON.stringify(result, (_key, value) => value instanceof Error ? { message: value.message, cause: value.cause } : value))
}
