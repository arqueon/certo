import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import ipaddr from 'ipaddr.js'
import { dataIntegritySuite, didDocuments, localDocumentLoader } from './data-integrity'
import { didWebDocumentUrl } from './did-web'

/** Public did:web resolution: pinned DNS, HTTPS, no redirects, bounded response.
 * The untrusted wallet cannot turn this endpoint into an internal HTTP proxy. */
export async function resolveWalletDidWeb(did: string): Promise<any> {
  const url = new URL(didWebDocumentUrl(did))
  if (url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) {
    throw new Error('Invalid wallet DID URL')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) {
    throw new Error('Wallet DID must resolve to a public address')
  }
  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: { Accept: 'application/did+ld+json, application/json' },
      // Pin the validated address, preventing DNS rebinding between check/use.
      lookup: ((_host, options, callback) => options.all
        ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, addresses[0].family)) as any,
    }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('DID resolution failed')); return }
      const chunks: Buffer[] = []; let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > 64 * 1024) request.destroy(new Error('DID document too large'))
        else chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (error) { reject(error) }
      })
    })
    const timer = setTimeout(() => request.destroy(new Error('DID resolution timed out')), 5000)
    request.on('error', reject)
    request.on('close', () => clearTimeout(timer))
  })
}

export async function walletDocumentLoader(controller: any) {
  const edContext = await import('ed25519-signature-2020-context')
  const documents = didDocuments(controller)
  // did:key includes X25519 in the controller context, even for authentication.
  const xContext = await import('x25519-key-agreement-2020-context')
  for (const module of [edContext, xContext]) for (const [url, value] of module.contexts) documents.set(url, value)
  for (const method of controller.authentication || []) {
    if (typeof method === 'object') documents.set(method.id, { '@context': controller['@context'], ...method })
  }
  return localDocumentLoader(documents)
}

/** Freewallet uses eddsa-rdfc-2022; LCW uses Ed25519Signature2020.
 * Verify only a DIDAuth presentation; no remote credential/context loading. */
export async function verifyWalletPresentation(vp: any, challenge: string, domain: string,
  resolveWeb = resolveWalletDidWeb): Promise<string> {
  const fail = () => { throw new Error('Invalid wallet presentation') }
  const proof = vp?.proof
  const holder = vp?.holder
  const contexts = vp?.['@context']
  const allowedContexts = ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1', 'https://w3id.org/security/data-integrity/v2']
  if (!vp || ![].concat(vp.type || []).includes('VerifiablePresentation')
    || !Array.isArray(contexts) || !allowedContexts.slice(0, 2).includes(contexts[0])
    || contexts.some(context => !allowedContexts.includes(context))
    || typeof holder !== 'string' || holder.length > 2048 || /[?#]/.test(holder)
    || !/^did:(key|web):/.test(holder) || !proof || Array.isArray(proof)
    || proof.proofPurpose !== 'authentication' || proof.challenge !== challenge || proof.domain !== domain
    || typeof proof.verificationMethod !== 'string'
    || (vp.verifiableCredential && (!Array.isArray(vp.verifiableCredential) || vp.verifiableCredential.length))) fail()
  let controller
  if (holder.startsWith('did:key:')) {
    const { driver } = await import('@digitalcredentials/did-method-key')
    const { Ed25519VerificationKey2020 } = await import('@digitalcredentials/ed25519-verification-key-2020')
    const resolver = driver()
    resolver.use({ multibaseMultikeyHeader: 'z6Mk', fromMultibase: Ed25519VerificationKey2020.from })
    controller = await resolver.get({ did: holder })
  } else controller = await resolveWeb(holder)
  if (controller.id !== holder || !controller.authentication?.some(method => (method.id || method) === proof.verificationMethod)) fail()
  const documentLoader = await walletDocumentLoader(controller)
  const { document: key } = await documentLoader(proof.verificationMethod)
  if (key.controller !== holder) fail()
  let suite
  if (proof.type === 'Ed25519Signature2020') {
    const { Ed25519Signature2020 } = await import('@digitalcredentials/ed25519-signature-2020')
    suite = new Ed25519Signature2020()
  } else if (proof.type === 'DataIntegrityProof' && proof.cryptosuite === 'eddsa-rdfc-2022') {
    suite = await dataIntegritySuite()
  } else fail()
  const { default: jsigs } = await import('jsonld-signatures')
  const result = await jsigs.verify(vp, { suite, documentLoader,
    purpose: new jsigs.purposes.AuthenticationProofPurpose({ challenge, domain, controller }) })
  if (!result.verified) fail()
  return holder
}
