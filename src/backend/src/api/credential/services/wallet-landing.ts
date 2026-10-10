/**
 * Page served at the VCALM interaction URL (`/api/exchanges/:id?iuv=1`) when
 * a browser opens it, e.g. after scanning the portal's single QR with the
 * phone camera. Wallets ask for `application/json` and keep getting the
 * protocols map; a browser gets this page with one button per supported
 * wallet. See docs/guardar-en-wallet.md, "Un solo QR".
 */
import { randomBytes } from 'node:crypto'

export interface WalletLandingOptions {
  /** The VC-API exchange URL (no query). */
  exchangeUrl: string
  /** False when the offer is unknown, expired or already used. */
  available: boolean
  /** Web wallet base URL (WALLET_APP_URL); its button is hidden when empty. */
  walletAppUrl?: string
  walletAppName?: string
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Prefers HTML only when the client asks for it ahead of JSON. */
export function wantsHtml(accepts: (...types: string[]) => string | false): boolean {
  return accepts('json', 'html') === 'html'
}

/** Freewallet reads the invitation from the hash route, not the query. */
export function webWalletLink(walletAppUrl: string, exchangeUrl: string): string {
  const url = new URL(walletAppUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid wallet URL')
  url.search = ''
  url.hash = `/request?request=${encodeURIComponent(JSON.stringify({ protocols: { vcapi: exchangeUrl } }))}`
  return url.href
}

export function walletLanding(options: WalletLandingOptions): { html: string; csp: string } {
  const nonce = randomBytes(16).toString('base64')
  const interactionUrl = `${options.exchangeUrl}?iuv=1`
  const appName = options.walletAppName || 'Cartera UDGPlus'
  const web = options.walletAppUrl ? webWalletLink(options.walletAppUrl, options.exchangeUrl) : ''
  const body = options.available
    ? `<h1>Guardar tu credencial</h1>
<p>Elige dónde guardarla. El enlace es personal, sirve una sola vez y caduca en unos minutos.</p>
${web ? `<a class="btn primary" href="${escapeHtml(web)}" rel="noreferrer">Abrir en ${escapeHtml(appName)}</a>` : ''}
<a class="btn" href="${escapeHtml(`interaction:${interactionUrl}`)}" rel="noreferrer">Abrir en la app ${escapeHtml(appName)}</a>
<button class="btn" type="button" id="copiar" data-url="${escapeHtml(interactionUrl)}">Copiar enlace</button>
<p class="nota" id="estado" role="status" aria-live="polite"></p>
<p class="nota">Si no tienes la app instalada, usa el primer botón. No compartas este enlace.</p>`
    : `<h1>Este enlace ya no está disponible</h1>
<p>Caducó o ya se usó. Vuelve al portal y pulsa <strong>Guardar en mi cartera</strong> para generar uno nuevo.</p>`
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>Guardar credencial</title>
<style nonce="${nonce}">
body{font-family:system-ui,sans-serif;margin:0;padding:24px 16px;background:#f6f8fb;color:#1d2a42}
main{max-width:28rem;margin:0 auto}h1{font-size:1.4rem;color:#00427b}
.btn{display:block;width:100%;box-sizing:border-box;margin:12px 0;padding:14px;border-radius:10px;border:1px solid #00427b;
background:#fff;color:#00427b;font:inherit;font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
.primary{background:#00427b;color:#fff}.nota{font-size:.9rem;color:#4a5568}
@media (prefers-color-scheme:dark){body{background:#12161f;color:#e8ebf0}h1{color:#9ccaff}
.btn{background:#1b2230;color:#9ccaff;border-color:#9ccaff}.primary{background:#9ccaff;color:#0b1a2c}.nota{color:#b7c0d4}}
</style></head><body><main>${body}</main>
${options.available ? `<script nonce="${nonce}">
document.getElementById('copiar').addEventListener('click', async (e) => {
  const estado = document.getElementById('estado')
  try { await navigator.clipboard.writeText(e.currentTarget.dataset.url); estado.textContent = 'Enlace copiado.' }
  catch { estado.textContent = 'No se pudo copiar; mantén pulsado el botón «Abrir…» para copiar su enlace.' }
})
</script>` : ''}
</body></html>`
  const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  return { html, csp }
}
