/**
 * The self-hosted site's public URL, resolved from runtimeConfig.public
 * (wired to NUXT_PUBLIC_WEBSITE_URL in nuxt.config.ts). Use this instead of
 * the WEBSITE_URL constant in app/constants/index.ts wherever the value
 * needs to reflect an actual deployment's configuration - that constant's
 * raw import.meta.env/process.env access is never populated by Nuxt/Vite
 * for a NUXT_PUBLIC_* var unless it also goes through runtimeConfig, so it
 * silently falls back to the production default in every build.
 */
export function useWebsiteUrl(): string {
  return useRuntimeConfig().public.websiteUrl || WEBSITE_URL
}
