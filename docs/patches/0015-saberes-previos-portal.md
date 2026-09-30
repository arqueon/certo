# 0015 · Reconocimiento de saberes previos en el portal del titular

**Estado:** implementación local en `feat/saberes-previos-portal`, sin commit, push ni despliegue. Depende del adaptador v1 de consola y de habilitación/configuración SSO/TLS.

Certo incorpora `/saberes-previos`, enlazado desde la cartera: catálogo y criterios, instancia, descripción, evidencias referenciadas, fecha opcional y solicitudes propias con plazo, respuesta, completar, nueva solicitud, reapertura única y confirmación de correo histórico. Usa la marca existente y texto en español; no muestra identificadores técnicos ni datos administrativos.

Un middleware server-side permite únicamente las nueve operaciones del contrato v1 de consola. Firma método, target, cuerpo, instante, nonce, actor de sesión, IP confiable e idempotencia con la clave exclusiva `portal-titular`. Nunca acepta identidad del navegador. Las escrituras comprueban origen; los reintentos conservan el mismo cuerpo/clave y renuevan nonce. Respeta Retry-After.

El parche 0011 no conserva sub ni una sesión HttpOnly para esta finalidad. Esta sección añade autorización por código OIDC con state/nonce/PKCE, validación de ID token y cookie cifrada Secure/HttpOnly/SameSite. No cambia el proveedor anterior. Requiere registrar un callback adicional, scope email con email_verified real, mismo sub entre clientes, canal HTTPS interno y secretos independientes de sesión/HMAC.

Configuración, firma byte a byte, rutas/cuerpos, pruebas reproducibles, archivos y dudas: `docs/portal-titular.md` en el fork. Las dependencias de prueba se instalaron solo en /tmp. Pasaron comprobaciones locales y navegador con datos sintéticos, incluido el verificador real de firma de consola. Pendientes: build completo, SSO y recorrido extremo a extremo en infraestructura real, revisión con titulares y habilitación de red/TLS.

El README de consola fue actualizado durante el trabajo. Se implementa su v1 final (prefijo `/api/portal-titular`, claves públicas de instancia, referencias UUID y firma de diez elementos), no el borrador inicial sin idempotencia. No se editó la consola, Keycloak, servicios ni archivos de secretos. Este texto queda en el checkout porque la carpeta externa de parches no está habilitada para escritura por el sandbox.
