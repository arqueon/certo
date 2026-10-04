#!/usr/bin/env node
// Run from any directory after `npm ci --include=dev` in src/backend.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire(new URL('../../src/backend/package.json', import.meta.url))
const { verifyCredential } = await import(pathToFileURL(require.resolve('@digitalcredentials/verifier-core')))
const source = process.argv[2]
if (!source) {
  console.error('Uso: node scripts/qa/verificar-dcc.mjs <archivo.json|URL>')
  process.exit(2)
}
try {
  let credential
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/vc+ld+json, application/ld+json, application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    credential = await response.json()
  } else credential = JSON.parse(await readFile(source, 'utf8'))
  // Accept the authenticated export API's wrapper, never a public projection.
  credential = credential.data || credential
  if (!credential.proof) throw new Error('Falta proof: usa el archivo original exportado por el titular')
  const result = await verifyCredential({ credential, knownDIDRegistries: [] })
  const { credential: _credential, ...checks } = result
  console.log(JSON.stringify(checks, null, 2))
  const log = result.log || []
  const signature = log.find(step => step.id === 'valid_signature')
  const failed = result.errors?.length || !signature?.valid
    || log.some(step => ['expiration', 'revocation_status'].includes(step.id) && !step.valid)
  const invalidSchema = result.additionalInformation?.some(info => Array.isArray(info.results)
    && info.results.some(check => check.result?.valid === false))
  console.log(failed ? 'DCC: firma, vigencia o estado NO verificados' : 'DCC: firma, vigencia y estado verificados')
  if (invalidSchema) console.log('DCC: el documento no cumple el esquema declarado o inferido')
  console.log('registered_issuer=false con la lista vacía no invalida la firma; el registro de confianza es independiente.')
  process.exitCode = failed || invalidSchema ? 1 : 0
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
