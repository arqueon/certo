#!/usr/bin/env bash
# Levanta `nuxt dev` con la marca UDGPlus y una API ficticia (127.0.0.1:3399, que
# intercepta Playwright en capturas.mjs). Sin backend real: solo para revisar la
# interfaz. Uso (desde src/frontend): scripts/capturas/servidor.sh [puerto]
set -euo pipefail
cd "$(dirname "$0")/../.."
export NUXT_PUBLIC_API_URL=http://127.0.0.1:3399
export NUXT_PUBLIC_WEBSITE_URL=https://microcredenciales.udgplus.udg.mx
export NUXT_PUBLIC_BRAND_NAME=UDGPlus
export NUXT_PUBLIC_BRAND_LOGO_URL=/udgplus-logo.svg
export NUXT_PUBLIC_BRAND_PRIMARY_COLOR='#00427B'
export NUXT_PUBLIC_OAUTH_PROVIDERS=keycloak
export NUXT_PUBLIC_DEFAULT_LOCALE=es
export NUXT_PUBLIC_DETECT_BROWSER_LOCALE=false
export NUXT_PUBLIC_PORTAL_TITULAR_ENABLED=true
export NUXT_PUBLIC_WALLET_APP_URL=https://cartera.microcredenciales.udgplus.udg.mx
export NUXT_PUBLIC_CATALOG_URL=https://catalogo.microcredenciales.udgplus.udg.mx/publico/catalogo
export NUXT_PUBLIC_ACCOUNT_URL=https://acceso.microcredenciales.udgplus.udg.mx/realms/udgplus/account
exec npx nuxt dev --host 127.0.0.1 --port "${1:-3311}"
