// Browser QA against the fictional, ephemeral portal-http fixture only.
import { chromium, expect } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM, headless: true, args: ['--no-sandbox'] })
const base = 'http://127.0.0.1:19300'
const path = `/credentials/${encodeURIComponent(fixture.id)}`
const artifacts = '/tmp/certo-recipient-render'
mkdirSync(artifacts, { recursive: true })
let count = 0
const check = async fn => { await fn(); count++ }
const errors = []
try {
  for (const locale of ['es', 'en']) {
    const context = await browser.newContext({ viewport: { width: locale === 'es' ? 390 : 1280, height: 900 } })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || route.request().url().startsWith('data:') ? route.continue() : route.abort())
    await context.addCookies([{ name: 'certo_locale', value: locale, url: base }])
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const surface of ['credential', 'verify']) {
      await page.goto(`${base}${surface === 'credential' ? path : '/verify'}`, { waitUntil: 'networkidle' })
      if (surface === 'verify') {
        await page.locator('#certificateId').fill(`${base}${path}`)
        await page.locator('button[type="submit"]').click()
      }
      const label = locale === 'es' ? 'Comprobar que pertenece a una persona: escribe su correo' : 'Check who this credential belongs to: enter their email'
      const field = page.getByLabel(label, { exact: true })
      await check(() => expect(field).toBeVisible())
      const form = field.locator('..').locator('..')
      const result = form.getByRole('status')
      await field.fill('qa-holder@example.test')
      const request = page.waitForRequest(r => r.url().endsWith('/check-recipient'))
      await form.getByRole('button').click()
      const sent = await request
      await check(() => expect(sent.method()).toBe('POST'))
      await check(() => expect(sent.url()).not.toContain('@'))
      await check(() => expect(result).toHaveText(locale === 'es' ? 'El correo coincide con el de esta credencial.' : 'The email matches this credential.'))
      await page.screenshot({ path: `${artifacts}/${locale}-${surface}.png`, fullPage: true })
      await field.fill('other@example.test')
      await check(() => expect(result).toHaveText(''))
      await form.getByRole('button').click()
      await check(() => expect(result).toHaveText(locale === 'es' ? 'El correo no coincide con el de esta credencial.' : 'The email does not match this credential.'))
      await check(async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true))
    }
    await context.close()
  }
  await check(() => expect(errors).toEqual([]))
  console.log(`RECIPIENT_BROWSER_PASS ${count} assertions`)
} finally { await browser.close() }
