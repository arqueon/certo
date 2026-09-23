/**
 * Lightweight i18n composable — no @nuxtjs/i18n dependency needed.
 * Reads locale JSON files directly; locale is stored in a Nuxt state ref
 * (SSR-compatible) and persisted in the LOCALE_COOKIE cookie.
 */

// Statically import all locale files so they are bundled with no async load
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import es from '../locales/es.json'
import de from '../locales/de.json'
import pt from '../locales/pt.json'

type LocaleCode = 'en' | 'fr' | 'it' | 'es' | 'de' | 'pt'

const MESSAGES: Record<LocaleCode, Record<string, any>> = { en, fr, it, es, de, pt }

export const LOCALES = [
  { code: 'en' as LocaleCode, name: 'English' },
  { code: 'fr' as LocaleCode, name: 'Français' },
  { code: 'it' as LocaleCode, name: 'Italiano' },
  { code: 'es' as LocaleCode, name: 'Español' },
  { code: 'de' as LocaleCode, name: 'Deutsch' },
  { code: 'pt' as LocaleCode, name: 'Português' },
]

// Locale used when the visitor has not picked one. English, as upstream;
// a deployment sets its own with NUXT_PUBLIC_DEFAULT_LOCALE.
export const FALLBACK_LOCALE: LocaleCode = 'en'

// BCP 47 tag handed to Intl for dates and numbers.
const INTL_LOCALES: Record<LocaleCode, string> = {
  es: 'es',
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it-IT',
  de: 'de-DE',
  pt: 'pt-BR',
}

export const LOCALE_COOKIE = 'certo_locale'

function isLocale(code: unknown): code is LocaleCode {
  return typeof code === 'string' && code in MESSAGES
}

/** Resolve a dot-separated key path in a nested object */
function resolve(obj: Record<string, any>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function useI18n() {
  const config = useRuntimeConfig()
  const configured = config.public.defaultLocale
  const defaultLocale: LocaleCode = isLocale(configured) ? configured : FALLBACK_LOCALE

  const localeCookie = useCookie<LocaleCode>(LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365 })
  // Read the cookie on the server too, so the HTML already comes out in the
  // chosen locale: no flash and no hydration mismatch.
  const locale = useState<LocaleCode>('locale', () =>
    isLocale(localeCookie.value) ? localeCookie.value : defaultLocale)

  /** Translate a dot-notation key, with optional `{param}` interpolation */
  function t(key: string, params?: Record<string, string | number>): string {
    const messages = MESSAGES[locale.value] ?? MESSAGES[defaultLocale]
    let value = resolve(messages, key)
      ?? resolve(MESSAGES[defaultLocale], key)
      ?? resolve(MESSAGES.en, key)
      ?? key
    if (params) {
      value = value.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`))
    }
    return value
  }

  function setLocale(code: LocaleCode | string) {
    const safe = isLocale(code) ? code : defaultLocale
    locale.value = safe
    localeCookie.value = safe
  }

  /** BCP 47 tag of the active locale, for Intl APIs */
  const intlLocale = computed(() => INTL_LOCALES[locale.value] ?? INTL_LOCALES[defaultLocale])

  /**
   * Format a date in the active locale. Returns `fallback` for an empty or
   * unparseable value instead of throwing.
   */
  function formatDate(
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
    fallback = '',
  ): string {
    if (value === null || value === undefined || value === '') return fallback
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return fallback || String(value)
    try {
      return new Intl.DateTimeFormat(intlLocale.value, options).format(date)
    }
    catch {
      return String(value)
    }
  }

  return {
    t,
    locale: readonly(locale),
    locales: readonly(ref(LOCALES)),
    setLocale,
    defaultLocale,
    intlLocale,
    formatDate,
  }
}
