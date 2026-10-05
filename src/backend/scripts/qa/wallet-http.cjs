// Called by portal-http.cjs --wallet; every assertion uses its disposable DB.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
module.exports = async function walletHttp({ app, request, credential, original, legacyId, holder, achievement }) {
  const { wallet } = await import('./wallet-signer.mjs')
  const { verifyWalletPresentation } = require('../../dist/src/utils/wallet-presentation')
  const id = encodeURIComponent(credential.credentialId)
  const route = `/holder/credentials/${id}`
  let count = 0
  const ok = (condition, message) => { assert.ok(condition, message); count++ }
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); count++ }
  const pathFor = offer => new URL(offer.exchangeUrl).pathname.slice(4)
  const makeOffer = async (credentialId = id) => {
    const response = await request(`/holder/credentials/${credentialId}/wallet-offer`, 'owner', {})
    ok(response.status === 200, `owner offer: ${response.status}`)
    return response.body.data
  }
  const dcc = async vc => {
    const didDocument = (await request('/issuer/did.json')).body
    const statusList = (await request(new URL(vc.credentialStatus.statusListCredential).pathname.slice(4))).body
    return JSON.parse(execFileSync(process.execPath, ['scripts/qa/dcc-local.mjs', '--core'], {
      input: JSON.stringify({ credential: vc, didDocument, statusList }), encoding: 'utf8', timeout: 20000,
    }))
  }
  ok((await request(`${route}/wallet-offer`, null, {})).status === 403, 'anonymous offer denied')
  ok((await request(`${route}/wallet-offer`, 'other', {})).status === 403, 'other holder offer denied')
  ok((await request(`${route}/wallet-offer`, 'manager', {})).status === 403, 'issuer offer denied')
  ok((await request(`/holder/credentials/${legacyId}/wallet-offer`, 'owner', {})).status === 409, 'legacy offer denied')
  ok((await request(`${route}/wallet-copies`, 'other')).status === 403, 'copy metadata denied to other holder')
  for (const name of ['wallet-offers', 'wallet-copies']) {
    ok((await request(`/${name}`, 'owner')).status === 404, `no generic ${name} API`)
  }
  const simulated = await wallet(), otherWallet = await wallet()
  const offer = await makeOffer()
  ok(offer.qrContent === offer.walletUrl && offer.walletUrl.startsWith('https://lcw.app/request.html?request='), 'official LCW link')
  equal(JSON.parse(new URL(offer.walletUrl).searchParams.get('request')), { protocols: { vcapi: offer.exchangeUrl } }, 'LCW request JSON')
  const exchangePath = pathFor(offer)
  const token = exchangePath.split('/').pop()
  let row = await app.db.query('api::wallet-offer.wallet-offer').findOne({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } })
  ok(row?.status === 'pending' && !JSON.stringify(row).includes(token), 'hashed token persisted without raw capability')
  const discovery = await request(`${exchangePath}?iuv=1`)
  equal(discovery.body, { protocols: { vcapi: offer.exchangeUrl } }, 'interaction GET discovery')
  const initial = await request(exchangePath, null, {})
  const vpr = initial.body.verifiablePresentationRequest
  ok(vpr.domain === '127.0.0.1:19337' && vpr.query[0].type === 'DIDAuthentication', 'DIDAuthentication request with configured host')
  equal(vpr.query[0].acceptedCryptosuites, [{ cryptosuite: 'eddsa-rdfc-2022' }], 'preferred cryptosuite advertised')
  equal(vpr.query[0].acceptedMethods, [{ method: 'key' }, { method: 'web' }], 'accepted DID methods')
  equal((await request(exchangePath, null, {})).body, initial.body, 'repeated initial request retains challenge')
  const missing = await request('/exchanges/nonexistent', null, {})
  ok(missing.status === 404, 'unknown exchange rejected')
  const failures = [
    await simulated.sign({ ...vpr, challenge: 'wrong-challenge' }),
    await simulated.sign({ ...vpr, domain: 'wrong.example.test' }),
    { '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiablePresentation'], holder: simulated.did },
    await otherWallet.sign(vpr, simulated.did),
  ]
  for (const vp of failures) {
    const invalid = await request(exchangePath, null, { verifiablePresentation: vp })
    ok(invalid.status === 404, 'invalid presentation rejected')
    equal(invalid.body, missing.body, 'no information leaked by invalid presentation')
  }
  const presentation = await simulated.sign(vpr)
  ok(await verifyWalletPresentation(presentation, vpr.challenge, vpr.domain) === simulated.did, 'standard DCC signer accepted by actual verifier')
  const completed = await request(exchangePath, null, { verifiablePresentation: presentation })
  ok(completed.status === 200, `complete exchange: ${completed.text}`)
  const copy = completed.body.verifiablePresentation.verifiableCredential[0]
  equal(copy.credentialSubject.id, simulated.did, 'wallet holder is bound as subject')
  equal(copy.credentialSubject.identifier, original.credentialSubject.identifier, 'hashed identity retained')
  equal(copy.credentialStatus, original.credentialStatus, 'same status list and index')
  ok(copy.id !== original.id && copy.id.startsWith('urn:uuid:'), 'new credential UUID')
  const comparable = structuredClone(copy); delete comparable.proof; comparable.id = original.id; delete comparable.credentialSubject.id
  const unsignedOriginal = structuredClone(original); delete unsignedOriginal.proof
  equal(comparable, unsignedOriginal, 'all other original claims preserved')
  equal((await request(`/credentials/${id}/export`, 'owner')).body.data, original, 'original is immutable')
  ok((await request('/credentials/validate', null, { credential: copy })).body.verified, 'bound copy passes Certo verifier')
  const core = await dcc(copy)
  ok(['valid_signature', 'revocation_status', 'expiration'].every(id => core.log.some(check => check.id === id && check.valid === true)), 'DCC signature, status and expiration checks pass')
  ok(core.additionalInformation.find(item => item.id === 'schema_check').results.every(item => item.result.valid === true), 'DCC OB3 schema check passes')
  console.log('WALLET_DCC_VALID', JSON.stringify({ log: core.log, additionalInformation: core.additionalInformation }))
  row = await app.db.query('api::wallet-offer.wallet-offer').findOne({ where: { id: row.id } })
  ok(row.status === 'used' && row.usedAt, 'used state persisted')
  for (const body of [{}, { verifiablePresentation: presentation }]) {
    const replay = await request(exchangePath, null, body)
    ok(replay.status === 404, 'used exchange rejected'); equal(replay.body, missing.body, 'same response for used and unknown')
  }
  equal((await request(`${exchangePath}?iuv=1`)).body, missing.body, 'used interaction response is identical')
  const summary = (await request(`${route}/wallet-copies`, 'owner')).body.data
  ok(summary.walletCount === 1 && summary.copies[0].holderDid === simulated.did && summary.copies[0].boundAt, 'owner sees copy DID and date')
  ok(!JSON.stringify(summary).includes('proofValue') && summary.revocation === 'shared', 'summary excludes signed content and declares shared status')
  const expiredOffer = await makeOffer()
  const expiredVpr = (await request(pathFor(expiredOffer), null, {})).body.verifiablePresentationRequest
  await app.db.query('api::wallet-offer.wallet-offer').updateMany({ where: { status: 'pending' }, data: { expiresAt: '2000-01-01T00:00:00Z' } })
  const expired = await request(pathFor(expiredOffer), null, { verifiablePresentation: await simulated.sign(expiredVpr) })
  equal(expired.body, missing.body, 'expired response identical'); ok(expired.status === 404, 'expired status 404')
  ok((await app.db.query('api::wallet-offer.wallet-offer').count({ where: { status: 'expired' } })) === 1, 'expiration persisted on access')
  const concurrent = await makeOffer()
  const concurrentPath = pathFor(concurrent)
  const challenge = (await request(concurrentPath, null, {})).body.verifiablePresentationRequest
  const responsePair = await Promise.all([simulated, otherWallet].map(async w => request(concurrentPath, null, { verifiablePresentation: await w.sign(challenge) })))
  equal(responsePair.map(r => r.status).sort(), [200, 404], 'concurrent redemption has exactly one winner')
  const dbCopies = await app.db.query('api::wallet-copy.wallet-copy').findMany({ where: { credential: credential.id } })
  ok(dbCopies.length === 2, 'only two successful redemptions persisted')

  // Browser CORS and a second real cryptographic exchange using Data Integrity.
  const webOffer = await makeOffer()
  const origin = 'https://cartera-microcredenciales.arqueonautis.org'
  const cors = async (url, source = origin, method = 'POST', requestedHeaders = 'Content-Type') => fetch(url, {
    method: 'OPTIONS', headers: { Origin: source, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': requestedHeaders },
  })
  const preflight = await cors(webOffer.exchangeUrl)
  equal(preflight.status, 204, 'wallet JSON preflight accepted')
  equal(preflight.headers.get('access-control-allow-origin'), origin, 'exact wallet origin')
  equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS', 'only exchange methods')
  equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type', 'only JSON header')
  equal(preflight.headers.get('access-control-allow-credentials'), null, 'no preflight credentials')
  for (const [url, source, method, headers] of [
    [webOffer.exchangeUrl, 'https://untrusted.example', 'POST', 'Content-Type'],
    [webOffer.exchangeUrl, origin, 'DELETE', 'Content-Type'],
    [webOffer.exchangeUrl, origin, 'POST', 'Authorization'],
    ['http://127.0.0.1:19337/api/credentials', origin, 'POST', 'Content-Type'],
    ['http://127.0.0.1:19337/api/holder/credentials/x/wallet-offer', origin, 'POST', 'Content-Type'],
  ]) equal((await cors(url, source, method, headers)).headers.get('access-control-allow-origin'), null, 'no CORS grant outside wallet scope')
  const postWeb = body => fetch(webOffer.exchangeUrl, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const webInitial = await postWeb({})
  equal(webInitial.headers.get('access-control-allow-origin'), origin, 'initial VPR readable by wallet')
  equal(webInitial.headers.get('access-control-allow-credentials'), null, 'no POST credentials')
  const webVpr = (await webInitial.json()).verifiablePresentationRequest
  const webWallet = await wallet(true)
  const webVp = await webWallet.sign(webVpr)
  equal(webVp.proof.type, 'DataIntegrityProof', 'web wallet signs Data Integrity')
  equal(webVp.proof.cryptosuite, 'eddsa-rdfc-2022', 'web wallet signs preferred suite')
  const webCompleted = await postWeb({ verifiablePresentation: webVp })
  equal(webCompleted.status, 200, 'Data Integrity exchange succeeds')
  equal((await webCompleted.json()).verifiablePresentation.verifiableCredential[0].credentialSubject.id, webWallet.did, 'web wallet bound to copy')
  equal((await postWeb({ verifiablePresentation: webVp })).headers.get('access-control-allow-origin'), origin, 'CORS on replay error')
  equal((await cors(webOffer.exchangeUrl, 'http://127.0.0.1:19301')).status, 204, 'comma-separated second origin')
  const portalPreflight = await cors('http://127.0.0.1:19337/api/credentials', 'http://127.0.0.1:19300')
  equal(portalPreflight.headers.get('access-control-allow-credentials'), 'true', 'existing portal CORS preserved')

  const rollbackOffer = await makeOffer(), rollbackPath = pathFor(rollbackOffer)
  const rollbackVpr = (await request(rollbackPath, null, {})).body.verifiablePresentationRequest
  const rollbackVp = await simulated.sign(rollbackVpr)
  const copyQuery = app.db.query('api::wallet-copy.wallet-copy'), createCopy = copyQuery.create
  copyQuery.create = async () => { throw new Error('Simulated database failure') }
  try {
    equal((await request(rollbackPath, null, { verifiablePresentation: rollbackVp })).body, missing.body, 'storage failure discloses no credential')
  } finally { copyQuery.create = createCopy }
  ok((await request(rollbackPath, null, { verifiablePresentation: rollbackVp })).status === 200, 'transaction rollback leaves offer redeemable')

  // A separate issuance keeps the portal's browser fixture usable.
  const issued = await request('/credentials/issue', 'manager', { data: {
    achievementId: achievement.id, recipientId: holder.id, recipient: { id: holder.id, name: holder.name, email: holder.email }, expirationDate: '2030-10-04T00:00:00Z',
  } })
  ok(issued.status === 200, 'separate revocation fixture issued')
  const rows = await app.entityService.findMany('api::credential.credential', { filters: { recipient: holder.id }, sort: { id: 'desc' } })
  const revokeId = encodeURIComponent(rows[0].credentialId)
  const revokeOffer = await makeOffer(revokeId), outstanding = await makeOffer(revokeId)
  const revokePath = pathFor(revokeOffer)
  const revokeVpr = (await request(revokePath, null, {})).body.verifiablePresentationRequest
  const linked = await request(revokePath, null, { verifiablePresentation: await simulated.sign(revokeVpr) })
  ok(linked.status === 200, 'revocation fixture bound')
  const revokeCopy = linked.body.verifiablePresentation.verifiableCredential[0]
  ok((await request(`/credentials/${rows[0].id}/revoke`, 'manager', { reason: 'Fictional wallet QA' })).status === 200, 'original revoked')
  ok((await request(`/holder/credentials/${revokeId}/wallet-offer`, 'owner', {})).status === 409, 'revoked offer rejected')
  const outstandingVpr = (await request(pathFor(outstanding), null, {})).body.verifiablePresentationRequest
  equal((await request(pathFor(outstanding), null, { verifiablePresentation: await simulated.sign(outstandingVpr) })).body, missing.body, 'pending offer cannot redeem after revocation')
  const invalidated = await request('/credentials/validate', null, { credential: revokeCopy })
  ok(invalidated.body.verified === false && invalidated.body.checks.some(c => c.check === 'not_revoked' && c.result === 'error'), 'Certo verifies copy as revoked')
  const coreRevoked = await dcc(revokeCopy)
  ok(coreRevoked.log.some(check => check.id === 'revocation_status' && check.valid === false), 'DCC verifier-core rejects revoked copy')
  console.log('WALLET_DCC_REVOKED', JSON.stringify({ log: coreRevoked.log, additionalInformation: coreRevoked.additionalInformation }))
  // Keep history out of the visual fixture without undoing any revocation.
  await app.entityService.delete('api::credential.credential', rows[0].id)
  console.log(`WALLET_HTTP_PASS ${count} assertions`)
}
