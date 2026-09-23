/**
 * i18n client plugin — runs on first page load in the browser.
 *
 * The initial locale comes from useI18n() (the LOCALE_COOKIE cookie or, if
 * unset, the instance default). If no cookie is set, this detects the browser
 * language and picks the closest supported locale, as upstream does. A
 * deployment that wants every visitor to land on its default locale sets
 * NUXT_PUBLIC_DETECT_BROWSER_LOCALE=false; the language switcher still works.
 */
import { LOCALE_COOKIE, LOCALES } from '~/composables/useI18n'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  if (String(config.public.detectBrowserLocale) === 'false') return

  const { setLocale } = useI18n()

  // Already have a saved preference
  const cookie = useCookie(LOCALE_COOKIE)
  if (cookie.value) return

  // Detect from navigator.languages
  const preferred = navigator.languages ?? [navigator.language ?? '']
  const supportedCodes = LOCALES.map(l => l.code)

  for (const lang of preferred) {
    const code = lang.slice(0, 2).toLowerCase()
    if (supportedCodes.includes(code as any)) {
      setLocale(code)
      return
    }
  }
})
