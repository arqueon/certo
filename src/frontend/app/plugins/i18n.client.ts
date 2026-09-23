/**
 * i18n client plugin — runs on first page load in the browser.
 *
 * El idioma inicial lo fija useI18n() (cookie LOCALE_COOKIE o, si no existe,
 * el idioma por defecto de la instancia, español). La detección por idioma
 * del navegador queda desactivada por defecto: en una instancia institucional
 * la página debe verse igual para todos (un navegador en inglés no debe
 * cambiarla) y así el HTML del servidor coincide con el del cliente. Se
 * puede reactivar con NUXT_PUBLIC_DETECT_BROWSER_LOCALE=true.
 */
import { LOCALE_COOKIE, LOCALES } from '~/composables/useI18n'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  if (String(config.public.detectBrowserLocale) !== 'true') return

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
