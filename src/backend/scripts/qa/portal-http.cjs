// Isolated HTTP regression: new temporary SQLite DB, generated session secrets,
// no .env, no seed accounts, and notifications replaced before issuing fixtures.
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
const directory = mkdtempSync(path.join(tmpdir(), 'certo-portal-http-'))
Object.assign(process.env, {
  NODE_ENV: 'production', ENV_PATH: path.join(directory, 'absent'),
  DATABASE_CLIENT: 'sqlite', DATABASE_FILENAME: path.relative(root, path.join(directory, 'test.db')),
  HOST: '127.0.0.1', PORT: '19337', PUBLIC_URL: 'http://127.0.0.1:19337', FRONTEND_URL: 'http://127.0.0.1:19300',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:19300',
  ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_KEYS: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'),
  ADMIN_JWT_SECRET: randomBytes(32).toString('hex'), API_TOKEN_SALT: randomBytes(32).toString('hex'),
  TRANSFER_TOKEN_SALT: randomBytes(32).toString('hex'), STRAPI_TELEMETRY_DISABLED: 'true',
  XDG_CONFIG_HOME: directory, PORTAL_TITULAR_ENABLED: 'false',
})
const { createStrapi } = require('@strapi/strapi')
async function main() {
  const app = await createStrapi({ appDir: root, distDir: path.join(root, 'dist') }).load()
  // No message can leave this QA instance.
  app.plugin('email').service('email').send = async () => ({})
  await app.listen()
  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } })
  const user = async name => app.db.query('plugin::users-permissions.user').create({ data: { username: name, email: `${name}@example.test`, provider: 'local', confirmed: true, blocked: false, role: role.id } })
  const owner = await user('qa-holder'), other = await user('qa-other'), manager = await user('qa-manager')
  const token = u => app.plugin('users-permissions').service('jwt').issue({ id: u.id })
  const tokens = { owner: token(owner), other: token(other), manager: token(manager) }
  const issuer = await app.entityService.create('api::profile.profile', { data: { name: 'UDGPlus QA', email: manager.email, url: 'http://127.0.0.1:19337', profileType: 'Issuer', owner: manager.id } })
  const holder = await app.entityService.create('api::profile.profile', { data: { name: 'Titular de prueba', email: owner.email, profileType: 'Recipient', owner: owner.id } })
  let count = 0
  async function request(url, who, body, method) {
    const response = await fetch(`http://127.0.0.1:19337/api${url}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const text = await response.text()
    return { status: response.status, headers: response.headers, text, body: text.startsWith('{') ? JSON.parse(text) : text }
  }
  const ok = (condition, message) => { assert.ok(condition, message); count++ }
  const achievement = await request('/achievements', 'manager', { data: { name: 'Análisis de información · prueba local', description: 'Datos ficticios para comprobar el portal.', achievementId: 'qa-skill', creator: issuer.id, criteria: { narrative: 'Demostrar el aprendizaje en una actividad evaluada.', url: 'https://catalog.example.test/skill' } } })
  ok(achievement.status === 200 || achievement.status === 201, `POST achievement: ${achievement.status} ${achievement.text}`)
  ok(achievement.body.data.criteria.url === 'https://catalog.example.test/skill', 'POST preserves criteria URL')
  const badge = await app.entityService.create('plugin::upload.file', { data: { name: 'QA badge', hash: 'qa-badge', folderPath: '/', ext: '.png', mime: 'image/png', size: 1, url: 'http://127.0.0.1:19300/placeholder-badge.png', provider: 'local' } })
  await app.entityService.update('api::achievement.achievement', achievement.body.data.id, { data: { image: badge.id } })
  const rubric = [{ id: 'urn:qa:criterion', name: 'Interpretar información', resultType: 'RubricCriterionLevel', rubricCriterionLevel: [{ id: 'urn:qa:level', name: 'Logrado', level: '1', description: 'Distingue lo que los datos permiten afirmar.' }] }]
  const issued = await request('/credentials/issue', 'manager', { data: { expirationDate: '2030-10-03T12:00:00Z', evidence: [{ name: holder.name, description: 'Evidencia ficticia del titular' }], resultDescription: rubric, result: [{ resultDescription: 'urn:qa:criterion', achievedLevel: 'urn:qa:level' }], awardedDate: '2026-09-01T00:00:00Z', achievementId: achievement.body.data.id, recipientId: holder.id, recipient: { id: holder.id, name: holder.name, email: holder.email } } })
  ok(issued.status === 200, `issue: ${issued.status} ${issued.text}`)
  const rows = await app.entityService.findMany('api::credential.credential', { filters: { recipient: holder.id } })
  const credential = rows[0]; ok(!!credential, 'credential persisted')
  const evidence = (await app.entityService.findMany('api::evidence.evidence', { filters: { credential: credential.id } }))[0]
  const id = encodeURIComponent(credential.credentialId)
  const original = await request(`/credentials/${id}/export`, 'owner')
  ok(original.status === 200, `owner export: ${original.status}`)
  ok(original.body.data.credentialSubject.achievement.criteria.id === 'https://catalog.example.test/skill', 'new OB3 criteria.id')
  ok(!original.text.toLowerCase().includes(holder.email.toLowerCase()), 'new signed document contains no recipient email')
  ok(!original.body.data.credentialSubject.id && original.body.data.credentialSubject.identifier[0].hashed, 'OB3 hashed identifier, no subject id')
  ok((await request(`/credentials/${id}/check-recipient`, null, { email: ` ${holder.email.toUpperCase()} ` })).body.matches === true, 'normalized recipient matches')
  ok((await request(`/credentials/${id}/check-recipient`, null, { email: 'other@example.test' })).body.matches === false, 'wrong recipient does not match')
  const tampered = structuredClone(original.body.data)
  tampered.credentialSubject.identifier[0].salt += '0'
  ok((await request('/credentials/validate', null, { credential: tampered })).body.verified === false, 'tampered salt invalidates signature')
  const visible = await request(`/credentials/${id}/verify`)
  ok(visible.body.verified === true && !visible.body.credential.proof && !visible.body.rawCredential.proof && !visible.text.includes('identityHash'), 'visible-name projection hides identifier and JWS')
  ok((await request(`/credentials/${id}/privacy`, 'other', { data: { publicLinkActive: false } }, 'PUT')).status === 403, 'other holder denied')
  ok((await request(`/credentials/${id}/privacy`, 'manager', { data: { publicLinkActive: false } }, 'PUT')).status === 403, 'issuer denied holder privacy')
  ok((await request(`/credentials/${id}/privacy`, 'owner', { data: { publicRecipientName: false } }, 'PUT')).status === 200, 'owner hides name')
  const hidden = await request(`/credentials/${id}/verify`)
  ok(hidden.status === 200 && hidden.body.verified, `hidden still verifies: ${hidden.status} ${hidden.text}`)
  ok(!hidden.text.includes(holder.name) && !hidden.text.includes(holder.email) && !hidden.body.credential.proof, 'public response has no name/email/JWS')
  const evidenceList = await request('/evidences')
  ok(evidenceList.status === 200 && evidenceList.body.data.length === 0, 'public evidence list hides holder evidence')
  ok((await request(`/evidences/${evidence.documentId}`)).status === 404, 'direct evidence unavailable')
  ok((await request(`/evidences/${evidence.documentId}`, 'owner')).status === 200, 'owner may read own evidence')
  const creatorCatalog = await request(`/achievements/creator/${issuer.id}`)
  ok(creatorCatalog.status === 200 && !creatorCatalog.text.includes(holder.name) && !creatorCatalog.text.includes(holder.email), 'creator catalog cannot populate private credentials')
  const svg = await request(`/credentials/${id}/certificate`)
  ok(svg.status === 200 && !svg.text.includes(holder.name), 'certificate image respects name hiding')
  const nested = await request(`/achievements/${achievement.body.data.documentId}?populate[credentials][populate]=recipient`)
  ok(!nested.text.includes(holder.name) && !nested.text.includes(holder.email), 'populate cannot bypass privacy')
  ok((await request(`/credentials/${id}/privacy`, 'owner', { data: { publicLinkActive: false } }, 'PUT')).status === 200, 'owner disables link')
  const disabledRecipient = await request(`/credentials/${id}/check-recipient`, null, { email: holder.email })
  const missingRecipient = await request('/credentials/urn:uuid:missing/check-recipient', null, { email: holder.email })
  ok(disabledRecipient.status === 404 && missingRecipient.status === 404 && disabledRecipient.text === missingRecipient.text, 'disabled and missing recipient checks have identical 404 responses')
  for (const suffix of ['', '/verify', '/certificate']) ok((await request(`/credentials/${id}${suffix}`)).status === 404, `public ${suffix || 'detail'} unavailable`)
  ok((await request(`/verify/${id}`)).status === 404, 'direct certificate unavailable')
  ok((await request(`/credentials/${id}/holder`, 'owner')).status === 200, 'owner still has access')
  ok((await request(`/credentials/${id}/holder`, 'other')).status === 403, 'other cannot access holder endpoint')
  const exported = await request(`/credentials/${id}/export`, 'owner')
  assert.deepEqual(exported.body.data, original.body.data); count++
  const validated = await request('/credentials/validate', null, { credential: original.body.data })
  ok(validated.body.verified === true, `signed file still verifies: ${validated.text}`)
  const history = await request('/holder/clrs', 'owner')
  ok(history.status === 200 && history.body.data.length === 0, 'no fabricated CLR')
  const clr = await app.service('api::clr.clr').emitir({ issuerId: issuer.id, subjectId: holder.id, credentialIds: [credential.id] })
  const clrId = clr.id.split('/').pop()
  ok((await request(`/clrs/${clrId}`)).status === 404, 'CLR public download blocked')
  ok((await request(`/clrs/${clrId}/verify`)).status === 404, 'CLR public verification blocked')
  ok((await request('/holder/clrs', 'owner')).body.data.length === 1, 'owner exports existing CLR')
  ok((await request('/holder/clrs', 'other')).body.data.length === 0, 'other holder sees no CLR')
  // Restore public fixture for an optional local browser check; no private token is printed.
  await request(`/credentials/${id}/privacy`, 'owner', { data: { publicLinkActive: true, publicRecipientName: true } }, 'PUT')
  // DID/public status responses are raw linked-data documents, not Strapi envelopes.
  const did = await request('/issuer/did.json')
  ok(did.status === 200 && did.body.id === 'did:web:127.0.0.1%3A19337', 'public DID identifier')
  ok(did.headers.get('content-type').includes('application/did+ld+json'), 'DID content type')
  ok(did.body.assertionMethod.includes(original.body.data.proof.verificationMethod), 'signing method authorized by DID')
  ok(!did.text.includes('privateKey') && !did.text.includes('secretKey') && !did.text.includes('publicKeyJwk'), 'DID only exposes Multikey public material')
  const listUrl = original.body.data.credentialStatus.statusListCredential.replace('http://127.0.0.1:19337/api', '')
  const list = await request(listUrl)
  ok(list.headers.get('content-type').includes('application/vc+ld+json'), 'status list content type')
  ok(list.body.type.includes('BitstringStatusListCredential') && list.body.proof.cryptosuite === 'eddsa-rdfc-2022', 'signed VC 2.0 status list')
  const { verifyDataIntegrity, verificationLoader } = require('../../dist/src/utils/data-integrity')
  ok((await verifyDataIntegrity(list.body, await verificationLoader(app, list.body))).valid, 'status list signature verifies')

  // A historical full-document JWS remains immutable and verifiable after rotation.
  const legacy = structuredClone(original.body.data)
  legacy.id = `urn:uuid:${require('node:crypto').randomUUID()}`
  legacy['@context'].push(require('../../dist/src/utils/credential-context').credentialContext)
  legacy.issuer.id = `http://127.0.0.1:19337/api/profiles/${issuer.id}/issuer`
  legacy.issuanceDate = legacy.validFrom
  legacy.expirationDate = legacy.validUntil
  delete legacy.validUntil
  legacy.proof = await app.service('api::credential.credential').generateLegacyProof(issuer.id, legacy)
  const legacyRow = await app.entityService.create('api::credential.credential', { data: {
    credentialId: legacy.id, name: legacy.name, description: legacy.description,
    issuanceDate: legacy.issuanceDate, expirationDate: legacy.expirationDate, awardedDate: legacy.credentialSubject.awardedDate,
    result: legacy.credentialSubject.result, resultDescription: legacy.credentialSubject.achievement.resultDescription,
    achievement: achievement.body.data.id, issuer: issuer.id, recipient: holder.id,
    signedCredential: legacy, proof: [legacy.proof], revoked: false,
  } })
  const legacyId = encodeURIComponent(legacy.id)
  ok((await request(`/credentials/${legacyId}/verify`)).body.verified, 'historical JWS verifies before rotation')
  const rotated = await request(`/profiles/${issuer.id}/rotate-key`, 'manager', { reason: 'Fictional local QA' })
  ok(rotated.status === 200, 'owner can rotate key')
  const afterDid = await request('/issuer/did.json')
  ok(afterDid.body.verificationMethod.length === 2, 'DID retains active and retired keys')
  ok((await request(`/credentials/${id}/verify`)).body.verified, 'Data Integrity still verifies after rotation')
  ok((await request(`/credentials/${legacyId}/verify`)).body.verified, 'historical JWS still verifies after rotation')
  ok((await request('/credentials/validate', null, { credential: legacy })).body.verified, 'historical upload still verifies after rotation')
  const legacyExport = await request(`/credentials/${legacyId}/export`, 'owner')
  assert.deepEqual(legacyExport.body.data, legacy); count++
  ok((await request(legacy.proof.verificationMethod.replace('http://127.0.0.1:19337/api', ''))).status === 200, 'historical key URL stays available')
  ok((await request(`/profiles/${issuer.id}/issuer`)).status === 200, 'historical issuer URL stays available')
  const mixed = await app.service('api::clr.clr').emitir({ subjectId: holder.id, issuerId: issuer.id, credentialIds: [credential.id, legacyRow.id] })
  ok(mixed.credentialSubject.achievement.some(vc => vc.proof.type === 'DataIntegrityProof')
    && mixed.credentialSubject.achievement.some(vc => vc.proof.jws), 'CLR groups both immutable formats')
  if (process.argv.includes('--wallet')) await require('./wallet-http.cjs')({ app, request, credential,
    original: original.body.data, legacyId, holder, achievement: achievement.body.data })
  // Keep browser QA's fixture list stable; the historical row was only needed for this regression.
  await app.entityService.delete('api::credential.credential', legacyRow.id)
  console.log(`PORTAL_HTTP_PASS ${count} assertions`)
  if (process.argv.includes('--browser')) {
    const { writeFileSync } = require('node:fs')
    writeFileSync(path.join(directory, 'credential.json'), JSON.stringify(original.body.data, null, 2))
    writeFileSync(path.join(directory, 'browser-fixture.json'), JSON.stringify({ id: credential.credentialId, token: tokens.owner, user: owner, issuerToken: tokens.manager, issuerUser: manager }))
    console.log(`BROWSER_FIXTURE ${directory}/browser-fixture.json`)
  } else { await app.destroy(); process.exit(0) }
}
main().catch(error => { console.error(error); process.exit(1) })
