# Enabling OAuth2 / OIDC Login

This is documentation plus one frontend page, deliberately **not** a
backend integration — Strapi's `users-permissions` plugin already ships
built-in connect strategies for Google, GitHub, Discord, and several other
providers. Enabling one is a matter of configuration, not code, and that
configuration is admin-panel/database-driven, not a `config/plugins.ts`
setting (unlike everything else in this backend). This doc exists so
"enable OAuth2/OIDC login" has a real, correct path rather than a
fabricated code path Strapi doesn't actually use.

**This has not been end-to-end tested** — doing so needs a real OAuth
app (client ID/secret) from an actual provider, which wasn't available in
the environment this was written in. Treat the steps below as accurate per
Strapi's own documented behavior, but have a human verify a real login
before relying on it.

## What's included in this pass

- `src/frontend/pages/auth/callback.vue` — a landing page for after the
  provider redirect completes. Reads `?access_token=<jwt>` (or `?error=...`)
  from the query string, and if present, calls the new
  `useAuthStore().loginWithOAuthToken(jwt)` (backed by
  `AuthClient.loginWithToken()`, `src/frontend/api/auth-client.ts`) to
  hydrate the session exactly like a local login does, then redirects to
  `/dashboard`.
- No backend code changes — the connect strategies are already part of
  `@strapi/plugin-users-permissions`.

## Enabling a provider (e.g. Google)

1. Create an OAuth app with your chosen provider (e.g. in Google Cloud
   Console) and obtain a client ID and secret.
2. In the provider's app settings, set the authorized redirect URI to
   Strapi's callback endpoint:
   `<backend-url>/api/connect/google/callback`
   (replace `google` with the provider name for other providers).
3. In Certo's Strapi admin panel: **Settings → Users & Permissions
   Plugin → Providers**, select the provider, enable it, and enter the
   client ID/secret from step 1.
4. In the same provider settings screen, set the **redirect URL** field to
   the frontend callback page added in this pass:
   `<frontend-url>/auth/callback`
5. From the frontend, initiate login by navigating to:
   `<backend-url>/api/connect/<provider>`

**The redirect carries the *provider's* token, not a Strapi one.** The chain
is:

```
/api/connect/<provider>          -> identity provider
  -> /api/connect/<provider>/callback   (grant exchanges the code)
  -> <frontend>/auth/callback?access_token=<PROVIDER token>
  -> /api/auth/<provider>/callback?access_token=...  -> { jwt, user }
```

That last hop is what resolves or creates the local user and issues the
Strapi JWT; `auth/callback.vue` performs it via
`authClient.loginWithProviderToken()`. An earlier version of this document
described step 5 as already yielding a Strapi JWT — it does not, and a
callback page that assumed so left every subsequent request unauthenticated.

A "Sign in with <brand>" button is wired into `login.vue`, driven by
`NUXT_PUBLIC_OAUTH_PROVIDERS` (comma-separated provider names, exposed
through `runtimeConfig.public.oauthProviders`).

### Providers behind an internal network

`grant` and `purest` both build their URLs as `https://{subdomain}` — one
hostname, forced to HTTPS, shared by the browser redirect *and* the
server-to-server token/userinfo calls. That cannot express a deployment where
the browser and the backend reach the identity provider at different
addresses.

`src/backend/src/bootstrap/keycloak-provider.ts` overrides the stock
`keycloak` provider with explicit `authorize_url` / `access_url` and its own
`authCallback`, driven by `KEYCLOAK_PUBLIC_URL` (browser) and
`KEYCLOAK_INTERNAL_URL` (backend). Without `KEYCLOAK_PUBLIC_URL` set, nothing
is overridden and the stock provider is left untouched.

## What's explicitly out of scope here

- LDAP and SCIM — unrelated to `users-permissions`' OAuth providers, not
  addressed at all.
- A UI for admins to manage which providers are enabled beyond Strapi's own
  admin panel screen.
- Programmatically seeding provider config (e.g. via `.env` + a bootstrap
  script) instead of the admin panel — Strapi doesn't offer a documented
  config-file-based path for this. `enabled`, `key`, `secret` and `callback`
  still have to be set once per deployment, either in the admin panel or with
  `PUT /users-permissions/providers`; values stored there win over anything
  the provider registry supplies.
