import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM, headless: true, args: ['--no-sandbox'] })
let assertions = 0
const cases = [
  { name: 'unbranded', env: {}, lang: 'en', heading: 'Design certificates & send to anyone', upstream: true },
  { name: 'brand without catalog', env: { NUXT_PUBLIC_BRAND_NAME: 'UDGPlus' }, lang: 'es', heading: 'Microcredenciales de UDGPlus' },
  { name: 'explicit default locale', env: { NUXT_PUBLIC_BRAND_NAME: 'UDGPlus', NUXT_PUBLIC_DEFAULT_LOCALE: 'en' }, lang: 'en', heading: 'UDGPlus microcredentials' },
  { name: 'explicit browser detection', env: { NUXT_PUBLIC_BRAND_NAME: 'UDGPlus', NUXT_PUBLIC_DETECT_BROWSER_LOCALE: 'true' }, lang: 'en', heading: 'UDGPlus microcredentials' },
]
try {
  for (const fixture of cases) {
    const server = spawn(process.execPath, ['.output/server/index.mjs'], { stdio: 'ignore', env: { ...process.env, HOST: '127.0.0.1', PORT: '19302', NUXT_PUBLIC_BRAND_NAME: '', NUXT_PUBLIC_BRAND_LOGO_URL: '', NUXT_PUBLIC_BRAND_PRIMARY_COLOR: '', NUXT_PUBLIC_CATALOG_URL: '', NUXT_PUBLIC_DEFAULT_LOCALE: '', NUXT_PUBLIC_DETECT_BROWSER_LOCALE: '', NUXT_PUBLIC_API_URL: 'http://127.0.0.1:19337', ...fixture.env } })
    const context = await browser.newContext({ locale: 'en-US' })
    try {
      await expect.poll(async () => { try { return (await fetch('http://127.0.0.1:19302')).status } catch { return 0 } }).toBe(200)
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
      const page = await context.newPage()
      await page.goto('http://127.0.0.1:19302', { waitUntil: 'networkidle' })
      await expect(page.locator('html')).toHaveAttribute('lang', fixture.lang); assertions++
      await expect(page.locator('h1')).toHaveText(fixture.heading); assertions++
      await expect(page.locator('nav a[href*="catalog"]')).toHaveCount(0); assertions++
      await expect(page.locator('article')).toHaveCount(fixture.upstream ? 0 : 2); assertions++
      if (fixture.upstream) { await expect(page.locator('nav a[href="/get-started"]')).toBeVisible(); assertions++ }
      console.log(`CONFIG_PASS ${fixture.name}`)
    } finally {
      await context.close()
      server.kill('SIGTERM'); await once(server, 'exit')
    }
  }
} finally { await browser.close() }
console.log(`PORTAL_CONFIG_PASS ${assertions} assertions`)
