import { walletLanding, wantsHtml, webWalletLink } from '../wallet-landing'

const exchangeUrl = 'https://credenciales.example.org/api/exchanges/abc'

// Mimics koa's ctx.accepts(...types): the first offered type the client takes.
const accepting = (header: string) => (...types: string[]) => {
  if (!header || header.includes('*/*')) {
    const html = header.indexOf('text/html')
    return html >= 0 && html < header.indexOf('*/*') ? 'html' : types[0]
  }
  return types.find((t) => header.includes(t === 'json' ? 'application/json' : 'text/html')) || false
}

describe('wantsHtml', () => {
  it('is true for a browser navigation', () => {
    expect(wantsHtml(accepting('text/html,application/xhtml+xml,*/*;q=0.8'))).toBe(true)
  })
  it('is false for a wallet asking for JSON', () => {
    expect(wantsHtml(accepting('application/json'))).toBe(false)
  })
  it('is false when the client sends no Accept header', () => {
    expect(wantsHtml(accepting(''))).toBe(false)
  })
})

describe('webWalletLink', () => {
  it('puts the invitation in the hash route', () => {
    const link = new URL(webWalletLink('https://cartera.example.org/?x=1', exchangeUrl))
    expect(link.search).toBe('')
    expect(link.hash.startsWith('#/request?request=')).toBe(true)
    expect(JSON.parse(decodeURIComponent(link.hash.split('request=')[1]))).toEqual({ protocols: { vcapi: exchangeUrl } })
  })
  it('refuses non-http schemes', () => {
    expect(() => webWalletLink('javascript:alert(1)', exchangeUrl)).toThrow()
  })
})

describe('walletLanding', () => {
  it('offers the web wallet, the app and a copy button', () => {
    const { html, csp } = walletLanding({ exchangeUrl, available: true, walletAppUrl: 'https://cartera.example.org' })
    expect(html).toContain('Abrir en Cartera UDGPlus')
    expect(html).toContain(`interaction:${exchangeUrl}?iuv=1`)
    expect(html).toContain('https://cartera.example.org/#/request?request=')
    expect(html).toContain('Copiar enlace')
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1]
    expect(nonce).toBeTruthy()
    expect(html).toContain(`<script nonce="${nonce}">`)
    expect(csp).toContain("default-src 'none'")
  })
  it('hides the web wallet button when no wallet URL is configured', () => {
    const { html } = walletLanding({ exchangeUrl, available: true })
    expect(html).not.toContain('#/request?request=')
    expect(html).toContain('Abrir en la app')
  })
  it('explains an unavailable offer without any link to it', () => {
    const { html } = walletLanding({ exchangeUrl, available: false, walletAppUrl: 'https://cartera.example.org' })
    expect(html).toContain('ya no está disponible')
    expect(html).not.toContain(exchangeUrl)
    expect(html).not.toContain('<script')
  })
  it('escapes the configured wallet name', () => {
    const { html } = walletLanding({ exchangeUrl, available: true, walletAppName: '<b>x</b>' })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
