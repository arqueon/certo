// Isolated 0023 contract QA. No .env, existing database, email or real keys.
const { mkdtempSync, writeFileSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
const directory = mkdtempSync(path.join(tmpdir(), 'certo-0023-http-'))
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
async function main() {
  const app = await require('@strapi/strapi').createStrapi({ appDir: root, distDir: path.join(root, 'dist') }).load()
  app.plugin('email').service('email').send = async () => ({})
  await app.listen()
  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } })
  const user = async (name, email) => app.db.query('plugin::users-permissions.user').create({ data: { username: name, email, provider: 'local', confirmed: true, blocked: false, role: role.id } })
  const owner = await user('titular', 'titular@example.org'), manager = await user('gestora', 'gestora@example.org'), other = await user('otra', 'otra@example.org')
  const token = u => app.plugin('users-permissions').service('jwt').issue({ id: u.id })
  const tokens = { owner: token(owner), manager: token(manager), other: token(other) }
  const issuer = await app.entityService.create('api::profile.profile', { data: { name: 'Consola de gestores UDGPlus', profileType: 'Issuer', owner: manager.id } })
  const request = async (url, data, who = 'manager', method = 'POST') => {
    const r = await fetch(`http://127.0.0.1:19337/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) }, ...(data ? { body: JSON.stringify({ data }) } : {}) })
    return { status: r.status, body: await r.json() }
  }
  let count = 0
  const ok = (condition, message) => { assert.ok(condition, message); count++ }
  const contract = JSON.parse(readFileSync(path.join(root, 'src/utils/__tests__/fixtures/metadata-contract.json')))
  const create = structuredClone(contract.create.data); create.creator = issuer.id
  const created = await request('/achievements', create)
  ok([200, 201].includes(created.status), `create ${JSON.stringify(created)}`)
  const stored = await app.entityService.findOne('api::achievement.achievement', created.body.data.id, { populate: ['creator'] })
  ok(stored.metadata0023.creator.name === create.achievement.creator.name && stored.creator.id === issuer.id, 'separate owner and creator')
  const badge = await app.entityService.create('plugin::upload.file', { data: { name: 'Insignia ficticia', hash: 'qa-0023-badge', folderPath: '/', ext: '.png', mime: 'image/png', size: 1, url: 'http://127.0.0.1:19300/placeholder-badge.png', provider: 'local' } })
  await app.entityService.update('api::achievement.achievement', stored.id, { data: { image: badge.id } })
  for (const invalid of [{ creator: { name: 'No', url: 'http://example.org' } }, { creditsAvailable: '2' }, { criteria: { url: 'javascript:x' } }, { alignment: [{ targetName: 'Nivel', targetType: 'Level' }] }]) {
    const response = await request('/achievements', { ...create, achievementId: `invalid-${count}`, achievement: invalid })
    ok(response.status === 400 && JSON.stringify(response.body).includes('Metadatos:'), 'create invalid metadata gives clear 400')
  }
  const issue = structuredClone(contract.issue.data); issue.achievementId = stored.id
  for (const invalid of [{ name: 25 }, { creditsEarned: '2' }, { activityEndDate: '2026-02-30T00:00:00Z' }, { identifiers: [{}] }]) {
    const response = await request('/credentials/issue', { ...issue, subject: invalid })
    ok(response.status === 400 && JSON.stringify(response.body).includes('Metadatos:'), 'issue invalid metadata gives clear 400')
  }
  const issued = await request('/credentials/issue', issue)
  ok(issued.status === 200, `issue ${JSON.stringify(issued)}`)
  const vc = issued.body.openBadge
  ok(vc.credentialSubject.name === issue.subject.name, 'signed name')
  ok(vc.credentialSubject.identifier.some(i => i.identityType === 'name' && !i.hashed), 'name IdentityObject')
  ok(vc.credentialSubject.identifier.some(i => i.identityType === 'emailAddress' && i.hashed), 'email stays salted')
  ok(vc.issuer.name === 'Universidad de Guadalajara', 'institutional issuer')
  ok((await app.entityService.findOne('api::profile.profile', issuer.id)).name === 'Consola de gestores UDGPlus', 'stored owner profile unchanged')
  const jsonld = require('jsonld')
  const { localDocumentLoader } = require('../../dist/src/utils/data-integrity')
  await jsonld.expand(vc, { safe: true, documentLoader: await localDocumentLoader() }); count++
  const did = await request('/issuer/did.json', null, null, 'GET')
  const status = await (await fetch(vc.credentialStatus.statusListCredential)).json()
  const dcc = spawnSync(process.execPath, [path.join(__dirname, 'dcc-local.mjs'), '--core'], { input: JSON.stringify({ credential: vc, didDocument: did.body, statusList: status }), encoding: 'utf8', timeout: 30000 })
  ok(dcc.status === 0, `dcc ${dcc.stderr}`)
  const result = JSON.parse(dcc.stdout)
  ok(!result.errors, 'no verifier-core fatal errors')
  for (const id of ['valid_signature', 'revocation_status', 'expiration']) ok(result.log.some(r => r.id === id && r.valid), id)
  ok(result.additionalInformation[0].results[0].result.valid === true, 'OB3 schema')
  writeFileSync(path.join(directory, 'verifier-core.json'), JSON.stringify(result, null, 2))
  const id = encodeURIComponent(vc.id)
  ok((await request(`/credentials/${id}/verify`, null, null, 'GET')).body.verified, 'public signature verified')
  ok((await request(`/credentials/${id}/privacy`, { publicRecipientName: false }, 'other', 'PUT')).status === 403, 'other owner denied')
  ok((await request(`/credentials/${id}/privacy`, { publicRecipientName: false }, 'owner', 'PUT')).status === 200, 'owner hides name')
  const hidden = await request(`/credentials/${id}/verify`, null, null, 'GET')
  ok(!JSON.stringify(hidden).includes(issue.subject.name) && !JSON.stringify(hidden).includes('identityHash'), 'all public name/identity copies removed')
  ok(hidden.body.credential.credentialSubject.term === '2026-B', 'period survives privacy')
  assert.deepEqual((await request(`/credentials/${id}/export`, null, 'owner', 'GET')).body.data, vc); count++
  await request(`/credentials/${id}/privacy`, { publicRecipientName: true }, 'owner', 'PUT')
  // Omission reuses the frozen achievement metadata; explicit {} does not.
  const inherited = await request('/credentials/issue', { achievementId: stored.id, recipient: issue.recipient })
  ok(inherited.body.openBadge.credentialSubject.achievement.humanCode === 'UDG-DATOS', 'stored achievement metadata used')
  const overridden = await request('/credentials/issue', { achievementId: stored.id, recipient: issue.recipient, achievement: {} })
  ok(!overridden.body.openBadge.credentialSubject.achievement.humanCode, 'explicit empty snapshot not filled from current achievement')
  const rubric = [{ id: 'urn:qa:criterion', name: 'Interpretar información', resultType: 'RubricCriterionLevel', rubricCriterionLevel: [{ id: 'urn:qa:level', name: 'Logrado', level: '1', description: 'Distingue lo que los datos permiten afirmar.' }] }]
  const withResults = await request('/credentials/issue', { ...issue, resultDescription: rubric, result: [{ resultDescription: 'urn:qa:criterion', achievedLevel: 'urn:qa:level' }] })
  ok(withResults.status === 200, 'metadata and existing results contract together')
  writeFileSync(path.join(directory, 'credential.json'), JSON.stringify(vc, null, 2))
  writeFileSync(path.join(directory, 'did.json'), JSON.stringify(did.body, null, 2))
  writeFileSync(path.join(directory, 'status.json'), JSON.stringify(status, null, 2))
  writeFileSync(path.join(directory, 'browser-fixture.json'), JSON.stringify({ id: withResults.body.openBadge.id, originalId: vc.id, token: tokens.owner, user: owner }))
  // A portable fictional documentation example: same ephemeral key, public
  // example.org identifiers, no dependence on the running loopback server.
  const localBase = process.env.PUBLIC_URL
  const sampleBase = 'https://credenciales.example.org'
  process.env.PUBLIC_URL = sampleBase
  app.config.set('server.url', sampleBase)
  const sample = JSON.parse(JSON.stringify(vc).replaceAll(localBase, sampleBase).replaceAll('did:web:127.0.0.1%3A19337', 'did:web:credenciales.example.org'))
  const { signCredential } = require('../../dist/src/utils/data-integrity')
  const signedSample = await signCredential(app, issuer.id, sample)
  const sampleDid = await require('../../dist/src/utils/issuer-did').issuerDidDocument(app)
  const sampleStatus = await signCredential(app, issuer.id, JSON.parse(JSON.stringify(status).replaceAll(localBase, sampleBase).replaceAll('did:web:127.0.0.1%3A19337', 'did:web:credenciales.example.org')))
  const sampleResult = spawnSync(process.execPath, [path.join(__dirname, 'dcc-local.mjs'), '--core'], { input: JSON.stringify({ credential: signedSample, didDocument: sampleDid, statusList: sampleStatus }), encoding: 'utf8', timeout: 30000 })
  const sampleVerified = JSON.parse(sampleResult.stdout)
  ok(sampleVerified.log.some(r => r.id === 'valid_signature' && r.valid) && sampleVerified.additionalInformation[0].results[0].result.valid, 'fictional documentation example signature and schema')
  writeFileSync(path.join(directory, 'example-signed.json'), JSON.stringify(signedSample, null, 2))
  writeFileSync(path.join(directory, 'example-did.json'), JSON.stringify(sampleDid, null, 2))
  writeFileSync(path.join(directory, 'example-status.json'), JSON.stringify(sampleStatus, null, 2))
  process.env.PUBLIC_URL = localBase
  app.config.set('server.url', localBase)
  console.log(`METADATA_HTTP_PASS ${count} assertions; safe JSON-LD; verifier-core signature/status/expiration/schema true`)
  console.log(`BROWSER_FIXTURE ${directory}/browser-fixture.json`)
  if (!process.argv.includes('--browser')) { await app.destroy(); process.exit(0) }
}
main().catch(error => { console.error(error); process.exit(1) })
