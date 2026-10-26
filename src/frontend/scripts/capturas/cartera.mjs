// Capturas del flujo «Guardar en mi cartera» (14-oct-2026): diálogo con las
// tres formas de guardar, aviso global de cartera nueva e insignia en el menú.
// 1. scripts/capturas/servidor.sh 3313
// 2. CAPTURAS_BASE=http://127.0.0.1:3313 node scripts/capturas/cartera.mjs DIR [filtro...]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.argv[2] || 'capturas-cartera'
const ONLY = process.argv.slice(3)
mkdirSync(OUT, { recursive: true })
const BASE = process.env.CAPTURAS_BASE || 'http://127.0.0.1:3313'
const API = 'http://127.0.0.1:3399'
const DAY = 86_400_000
const iso = d => new Date(Date.now() + d * DAY).toISOString()
const user = { id: 8, username: 'ana.lopez', email: 'ana.lopez@microcredenciales.invalid', provider: 'keycloak', confirmed: true }
const profile = { id: 7, name: 'Ana López Ruiz', email: user.email, profileType: 'Recipient' }
const cred = (id, name, type, issued, expires) => ({ id, credentialId: `urn:uuid:${id}`, name, issuanceDate: iso(issued), expirationDate: iso(expires), revoked: false, issuer: { name: 'Universidad de Guadalajara' }, achievement: { name, achievementType: type } })
const credentials = [cred('0001-a', 'Diseño instruccional con IA generativa', 'MicroCredential', -8, 1095), cred('0002-b', 'Evaluación auténtica en entornos virtuales', 'MicroCredential', -22, 1080)]
const exchangeUrl = 'https://microcredenciales.udg.mx/api/exchanges/ejemploEjemploEjemploEjemploEjemploEjemplo1'
const offer = {
  exchangeUrl,
  interactionUrl: `${exchangeUrl}?iuv=1`,
  walletUrl: 'x',
  qrContent: `${exchangeUrl}?iuv=1`,
  webWalletUrl: `https://cartera.microcredenciales.udg.mx/#/request?request=${encodeURIComponent(JSON.stringify({ protocols: { vcapi: exchangeUrl } }))}`,
  expiresAt: iso(9 / 1440),
}
const wallets = [{ id: 1, kind: 'account', client: 'web', name: 'Cartera UdeG', addedAt: iso(-20), credentials: 2, lastSavedAt: iso(-2) }]
const pendiente = { offerId: 9, credentialId: 'urn:uuid:0001-a', credentialName: 'Diseño instruccional con IA generativa', client: 'web', name: 'Cartera UdeG', requestedAt: iso(0), expiresAt: iso(8 / 1440) }
const summary = { eligible: true, legacy: false, walletCount: 1, copies: [{ holderDid: 'did:key:x', boundAt: iso(-2), credentialId: 'c' }] }

function responder(state) {
  return async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname
    const headers = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type, authorization, idempotency-key', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers })
    }
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (p === '/api/profiles/me') {
      return json({ data: profile })
    }
    if (p === '/api/users/me') {
      return json(user)
    }
    if (p.endsWith('/received-credentials')) {
      return json({ data: credentials })
    }
    if (p.endsWith('/wallet-copies')) {
      return json({ data: { ...summary, pendingWallet: state.dialogoPendiente ? pendiente : null } })
    }
    if (p.endsWith('/wallet-offer')) {
      return json({ data: offer })
    }
    if (p.endsWith('/decision')) {
      state.pendiente = false
      return json({}, 200)
    }
    if (p === '/api/holder/wallet-pending') {
      return json({ data: state.pendiente ? [pendiente] : [] })
    }
    if (p === '/api/holder/wallets') {
      return json({ data: wallets })
    }
    return json({ data: [] })
  }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const errors = []
async function shot(name, { path, mobile, dark, state = {}, action, full }) {
  if (ONLY.length && !ONLY.some(o => name.includes(o))) {
    return
  }
  const context = await browser.newContext({
    viewport: mobile ? { width: 412, height: 915 } : { width: 1366, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: !!mobile,
    hasTouch: !!mobile,
    colorScheme: dark ? 'dark' : 'light',
    locale: 'es-MX',
  })
  await context.addInitScript(({ user, modo }) => {
    localStorage.setItem('token', 'ficticio')
    localStorage.setItem('user', JSON.stringify(user))
    if (modo) {
      localStorage.setItem('mc-cartera-modo', modo)
    }
  }, { user, modo: state.modo })
  await context.route(`${API}/**`, responder(state))
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) {
      errors.push(`${name}: ${m.text()}`)
    }
  })
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'nuxt-devtools-frame, #nuxt-devtools-container { display: none !important; }' })
  await page.evaluate(() => document.fonts.ready)
  if (action) {
    await action(page)
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full })
  await context.close()
}

const abrir = async (page) => {
  await page.getByTestId('credencial-destacada').getByRole('button', { name: 'Guardar en mi cartera' }).click()
  await page.waitForSelector('dialog[open] .hw-modos')
}
for (const dark of [false, true]) {
  const m = dark ? 'oscuro' : 'claro'
  for (const modo of ['web', 'app', 'otro']) {
    await shot(`dialogo-${modo}-escritorio-${m}`, { path: '/dashboard', dark, state: { modo }, action: abrir })
    await shot(`dialogo-${modo}-movil-${m}`, { path: '/dashboard', mobile: true, dark, state: { modo }, action: abrir })
  }
  await shot(`aviso-escritorio-${m}`, { path: '/dashboard', dark, state: { pendiente: true } })
  await shot(`aviso-movil-${m}`, { path: '/dashboard', mobile: true, dark, state: { pendiente: true } })
  await shot(`aviso-carteras-movil-${m}`, { path: '/carteras', mobile: true, dark, state: { pendiente: true } })
}
await shot('aviso-confirmado-escritorio-claro', {
  path: '/dashboard',
  state: { pendiente: true },
  action: async (page) => {
    await page.locator('button.aviso-approve').click()
    await page.waitForSelector('.mc-aviso-cartera--hecho')
  },
})
await shot('dialogo-pendiente-escritorio-claro', { path: '/dashboard', state: { modo: 'web', dialogoPendiente: true }, action: async (page) => {
  await page.getByTestId('credencial-destacada').getByRole('button', { name: 'Guardar en mi cartera' }).click()
  await page.waitForSelector('dialog[open] .wallet-approve')
} })
await shot('carteras-agregar-escritorio-claro', { path: '/carteras', full: true })
await browser.close()
console.log(errors.length ? `ERRORES:\n${[...new Set(errors)].join('\n')}` : 'sin errores de página')
