/**
 * Registers a Keycloak OIDC provider that works when the browser and the
 * server reach Keycloak at *different* addresses.
 *
 * Strapi already ships a `keycloak` provider in users-permissions, but it is
 * unusable behind an internal network: both `grant` (token exchange) and
 * `purest` (userinfo) build their URLs as `https://{subdomain}` — a single
 * hostname, forced to HTTPS, shared by the browser redirect and the two
 * server-to-server calls. A deployment where Keycloak is reachable by the
 * browser at a public URL and by the backend at an internal one cannot be
 * expressed that way.
 *
 * This override supplies explicit URLs instead of a `subdomain`: grant merges
 * the provider config over its own defaults, so `authorize_url`/`access_url`
 * win, and `authCallback` fetches userinfo directly rather than through
 * purest's template.
 *
 * Opt-in: without KEYCLOAK_PUBLIC_URL this does nothing and the stock
 * provider is left untouched.
 */

/** Realm base URL as the *browser* must reach it, e.g. https://id.example.org/realms/myrealm */
const PUBLIC_URL = process.env.KEYCLOAK_PUBLIC_URL;
/** Realm base URL as the *backend* must reach it. Defaults to the public one. */
const INTERNAL_URL = process.env.KEYCLOAK_INTERNAL_URL || PUBLIC_URL;

export function registerKeycloakProvider(strapi: any) {
  if (!PUBLIC_URL) return;

  const sinBarra = (url: string) => url.replace(/\/+$/, '');
  const publico = sinBarra(PUBLIC_URL);
  const interno = sinBarra(INTERNAL_URL as string);

  strapi.plugin('users-permissions').service('providers-registry').add('keycloak', {
    icon: 'key',
    enabled: true,
    grantConfig: {
      key: process.env.KEYCLOAK_CLIENT_ID || 'certo',
      secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
      callback: `${sinBarra(strapi.config.server.url)}/api/auth/keycloak/callback`,
      scope: ['openid', 'email', 'profile'],
      oauth: 2,
      scope_delimiter: ' ',
      // The browser is redirected here...
      authorize_url: `${publico}/protocol/openid-connect/auth`,
      // ...but this exchange happens from inside the server.
      access_url: `${interno}/protocol/openid-connect/token`,
    },

    async authCallback({ accessToken }: { accessToken: string }) {
      const respuesta = await fetch(`${interno}/protocol/openid-connect/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!respuesta.ok) {
        throw new Error(
          `Keycloak userinfo responded ${respuesta.status}: ${await respuesta.text()}`
        );
      }

      const perfil: any = await respuesta.json();

      // Only the two fields users-permissions knows how to consume. The stable
      // Keycloak subject (`perfil.sub`) is deliberately dropped: there is no
      // field on the Strapi user to hold it yet — see parche 0011.
      return { username: perfil.preferred_username, email: perfil.email };
    },
  });

  strapi.log.info(
    `[keycloak] OIDC provider registered (browser: ${publico}, server: ${interno})`
  );
}
