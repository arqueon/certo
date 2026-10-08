import { chromium, expect } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const webWallet = process.env.QA_WALLET_APP_URL || ''
const artifacts = webWallet ? '/tmp/certo-wallet-web-render' : '/tmp/certo-wallet-render'
mkdirSync(artifacts, { recursive: true })
const base = 'http://127.0.0.1:19300'
let walletServer
let count = 0
const errors = []
const check = async fn => { await fn(); count++ }
async function session(viewport, locale = 'es', owner = true) {
  const context = await browser.newContext({ viewport, locale: locale === 'es' ? 'es-MX' : 'en-US' })
  await context.addCookies([{ name: 'certo_locale', value: locale, url: base }])
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || route.request().url().startsWith('data:') ? route.continue() : route.abort())
  if (owner) await context.addInitScript(({ user, token }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)) }, fixture)
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  return { context, page }
}
try {
  const desktop = await session({ width: 1360, height: 1000 })
  await desktop.page.goto(`${base}/credentials/${encodeURIComponent(fixture.id)}`, { waitUntil: 'networkidle' })
  const control = desktop.page.getByTestId('holder-wallet')
  await check(() => expect(control.getByRole('button', { name: 'Guardar en mi cartera', exact: true })).toBeEnabled())
  await check(() => expect(control.locator('abbr').first()).toBeVisible())
  await control.getByRole('button', { name: 'Guardar en mi cartera', exact: true }).click()
  await check(() => expect(control.locator('img.wallet-qr').first()).toBeVisible())
  await check(() => expect(control.locator('[role="timer"]')).toContainText(/Vence en (10:00|9:\d\d)/))
  await check(() => expect(control.locator('a.wallet-open')).toHaveText('Abrir en este dispositivo'))
  await check(() => expect(control.locator('img.wallet-qr')).toHaveCount(1))
  await check(() => expect(control.locator('details')).toHaveCount(0))
  const previousQr = await control.locator('img').first().getAttribute('src')
  await control.getByRole('button', { name: 'Generar uno nuevo' }).click()
  await check(() => expect(control.locator('img').first()).not.toHaveAttribute('src', previousQr))
  await control.evaluate(el => el.scrollIntoView({ block: 'start' }))
  await control.screenshot({ path: `${artifacts}/desktop-es.png` })
  await desktop.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' })
  await check(() => expect(desktop.page.getByRole('button', { name: 'Guardar en mi cartera', exact: true })).toBeVisible())
  await desktop.page.getByRole('button', { name: 'Guardar en mi cartera', exact: true }).click()
  await check(() => expect(desktop.page.locator('img.wallet-qr').first()).toBeVisible())
  await desktop.page.screenshot({ path: `${artifacts}/dashboard-es.png`, fullPage: true })
  const mobile = await session({ width: 390, height: 844 }, 'en')
  await mobile.page.goto(`${base}/credentials/${encodeURIComponent(fixture.id)}`, { waitUntil: 'networkidle' })
  const mobileControl = mobile.page.getByTestId('holder-wallet')
  await mobileControl.getByRole('button', { name: 'Save to my wallet', exact: true }).click()
  await check(() => expect(mobileControl.getByRole('link', { name: 'Open on this device' })).toBeVisible())
  const href = await mobileControl.locator('a.wallet-open').getAttribute('href')
  // One QR and one link: the interaction URL. Wallets get JSON, browsers a page.
  await check(() => expect(new URL(href).searchParams.get('iuv')).toBe('1'))
  const invitation = await fetch(href, { headers: { Accept: 'application/json' } }).then(r => r.json())
  const landing = await fetch(href, { headers: { Accept: 'text/html' } })
  await check(() => expect(landing.headers.get('content-type')).toContain('text/html'))
  await check(async () => expect(await landing.text()).toContain('interaction:'))
  const { default: QRCode } = await import('qrcode')
  const expectedQr = QRCode.create(href, { errorCorrectionLevel: 'M' }).modules
  const qrMatches = await mobileControl.locator('img').first().evaluate((img, { size, data }) => {
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    const scale = canvas.width / (size + 8)
    return data.every((value, i) => {
      const pixel = ctx.getImageData(Math.floor((i % size + 4.5) * scale), Math.floor((Math.floor(i / size) + 4.5) * scale), 1, 1).data
      return (pixel[0] < 128) === !!value
    })
  }, { size: expectedQr.size, data: Array.from(expectedQr.data) })
  await check(() => expect(qrMatches).toBe(true))
  const vpr = await fetch(invitation.protocols.vcapi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json())
  await check(() => expect(vpr.verifiablePresentationRequest.query[0].type).toBe('DIDAuthentication'))
  await check(async () => expect(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true))
  await mobileControl.screenshot({ path: `${artifacts}/mobile-en.png` })
  const { wallet } = await import('../../backend/scripts/qa/wallet-signer.mjs')
  const simulated = await wallet(!!webWallet)
  const beforeCopies = await mobileControl.locator('li').count()
  const signed = await simulated.sign(vpr.verifiablePresentationRequest)
  let redeemed
  if (webWallet) {
    // An actual cross-origin browser fetch: no cookies, real preflight, real backend.
    const walletContext = await browser.newContext()
    const walletPage = await walletContext.newPage()
    walletPage.on('console', message => { if (message.type() === 'error') console.log('WALLET_TRANSPORT', message.text().replace(/\/api\/exchanges\/[^ ?]+/g, '/api/exchanges/[redacted]')) })
    walletServer = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>Wallet transport QA</title>') })
    await new Promise(resolve => walletServer.listen(19301, '127.0.0.1', resolve))
    await walletPage.goto('http://127.0.0.1:19301/')
    const result = await walletPage.evaluate(async ({ url, signed }) => {
      const initial = await fetch(url, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const vpr = await initial.json()
      const response = await fetch(url, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verifiablePresentation: signed }) })
      const body = await response.json()
      let outsideDenied = false
      try { await fetch(new URL('/api/credentials', url), { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { outsideDenied = true }
      return { status: response.status, vpr, body, outsideDenied }
    }, { url: invitation.protocols.vcapi, signed })
    await check(() => expect(result.vpr.verifiablePresentationRequest.query[0].acceptedCryptosuites).toEqual([{ cryptosuite: 'eddsa-rdfc-2022' }]))
    await check(() => expect(result.body.verifiablePresentation.verifiableCredential[0].credentialSubject.id).toBe(simulated.did))
    await check(() => expect(result.outsideDenied).toBe(true))
    redeemed = result
    await walletContext.close()
  } else redeemed = await fetch(invitation.protocols.vcapi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verifiablePresentation: signed }) })
  await check(() => expect(redeemed.status).toBe(200))
  await check(() => expect(mobileControl.locator('li')).toHaveCount(beforeCopies + 1, { timeout: 10000 }))
  await check(() => expect(mobileControl.locator('a.wallet-open')).toHaveCount(0))
  await mobileControl.screenshot({ path: `${artifacts}/mobile-bound-en.png` })
  // Real clock expiry is covered in unit/backend tests; intercept only this UI
  // response to inspect the rendered expired state without a ten-minute wait.
  await mobile.page.route('**/wallet-offer', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { exchangeUrl: invitation.protocols.vcapi, walletUrl: href, qrContent: href, expiresAt: '2000-01-01T00:00:00Z' } }) }))
  await mobileControl.getByRole('button', { name: 'Save to my wallet', exact: true }).click()
  await check(() => expect(mobileControl.getByText('This link has expired. Generate a new one to continue.')).toBeVisible())
  await check(() => expect(mobileControl.locator('a.wallet-open')).toHaveCount(0))
  await mobileControl.screenshot({ path: `${artifacts}/mobile-expired-en.png` })
  const visitor = await session({ width: 390, height: 844 }, 'es', false)
  await visitor.page.goto(`${base}/credentials/${encodeURIComponent(fixture.id)}`, { waitUntil: 'networkidle' })
  await check(() => expect(visitor.page.getByTestId('holder-wallet')).toHaveCount(0))
  await desktop.page.route('**/wallet-copies', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { eligible: false, legacy: true, walletCount: 0, copies: [] } }) }))
  await desktop.page.goto(`${base}/credentials/${encodeURIComponent(fixture.id)}`, { waitUntil: 'networkidle' })
  await check(() => expect(control.getByRole('button', { name: 'Guardar en mi cartera', exact: true })).toBeDisabled())
  await check(() => expect(control.getByText(/Solicita al emisor que la reemita/)).toBeVisible())
  await control.evaluate(el => el.scrollIntoView({ block: 'start' }))
  await control.screenshot({ path: `${artifacts}/legacy-es.png` })
  await check(() => expect(errors).toEqual([]))
  console.log(`WALLET_BROWSER_PASS ${count} assertions; screenshots ${artifacts}`)
} finally { await browser.close(); if (walletServer) await new Promise(resolve => walletServer.close(resolve)) }
