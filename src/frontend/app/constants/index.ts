/**
 * URL of the Certo website.
 *
 * Defaults to the production URL for convenience but can be overridden
 * via the NUXT_PUBLIC_WEBSITE_URL env var for self-hosted deployments.
 * This powers canonical links, OG images, shareable URLs, and QR codes
 * on certificates.
 *
 * @see docs/known-issues-and-dev-notes.md item 33
 */
export const WEBSITE_URL = import.meta.env?.NUXT_PUBLIC_WEBSITE_URL
  ?? process.env.NUXT_PUBLIC_WEBSITE_URL
  ?? 'https://certo.schroedinger-hat.org'

// "About" y "Docs" (información del proyecto de código abierto Certo, no
// relevante para un titular UDGPlus) se quitaron a propósito del menú --
// las páginas siguen existiendo en el código, solo no aparecen en la
// navegación visible.
export const HEADER_NAV_LINKS = [
  { name: 'Home',         href: '/',          i18nKey: 'home' },
  { name: 'Dashboard',    href: '/dashboard',  i18nKey: 'dashboard' },
  { name: 'Issue Badges', href: '/issue',      i18nKey: 'issue' },
  { name: 'Verify',       href: '/verify',     i18nKey: 'verify' },
]
export const HELLO_SH_MAIL = 'mailto:hello@schroedinger-hat.org'

// Botón oficial «Agregar al perfil» de LinkedIn, en la variante de idioma que
// LinkedIn publica para cada locale de la interfaz (es_LA no existe; se usa
// es_ES).
const LINKEDIN_BUTTON_LOCALES: Record<string, string> = {
  es: 'es_ES',
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_BR',
}

export function linkedInButtonImage(locale: string): string {
  const variant = LINKEDIN_BUTTON_LOCALES[locale] ?? 'en_US'
  return `https://download.linkedin.com/desktop/add2profile/buttons/${variant}.png`
}
