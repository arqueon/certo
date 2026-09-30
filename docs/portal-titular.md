# Reconocimiento de saberes previos en Certo

Implementación local del lado Certo del contrato v1 de `laboratorio/consola-gestores/README.md`, sección «Contrato propuesto para el portal del titular (Certo + SSO)», leído de nuevo el 29-sep-2026 después de su actualización por la implementación paralela. Sin despliegue, cambios de servicios, lectura de archivos de entorno ni uso de secretos reales.

## Alcance

La página `/saberes-previos`, enlazada desde `/dashboard`, usa el layout y `useBranding()` existentes. Muestra catálogo y criterios públicos, instancia, nombre, correo verificado de sesión, matrícula opcional, saberes, referencias a evidencias y fecha de logro opcional. El seguimiento incluye plazo proporcionado por consola, respuesta y criterios, indicaciones, completar, nueva solicitud, una reapertura y confirmación de correo histórico. La cartera enlaza a `/dashboard`; no se construyen URLs de credenciales. No se muestran claves, referencias, identificadores internos ni datos administrativos.

El backend intercepta **solo** `/api/portal-titular/*` antes del logger y del parser general. Aplica sesión propia, rechazo de Origin ajeno en todas las rutas, incluidas las GET; Origin obligatorio para escrituras, allowlist de rutas/query y campos, límite de 65536 bytes, firma del cuerpo exacto, timeout de 15 segundos y rechazo de redirecciones. Construye las cabeceras de cero. Nunca reenvía Bearer, cookies, roles o identidad del navegador. Las respuestas personales se vuelven a proyectar mediante una allowlist; los errores de consola se traducen por estado, sin mostrar su payload interno. El catálogo usa la proyección pública de consola.

El frontend no reintenta automáticamente POST. Un envío inicial usa una clave de idempotencia aleatoria y conserva una copia inmutable del cuerpo hasta confirmar el resultado. Ante incertidumbre relee la lista y permite reintentar ese mismo cuerpo y clave; cada llamada del backend lleva nonce/timestamp nuevos. Un 409 de transición relee el detalle y conserva el texto. Se respeta `Retry-After` en presentación. **El borrador y la clave viven en memoria de la página**, no en almacenamiento persistente: antes de renovar acceso o recargar con un envío incierto hay que consultar la lista y conservar el texto necesario.

## Identidad SSO

El parche 0011 consulta userinfo y devuelve solo username/email; su flujo entrega el token del proveedor al navegador y el portal antiguo guarda el JWT local. No constituye la sesión requerida por este contrato. Por eso esta sección usa un flujo adicional de autorización por código, sin modificar el proveedor anterior ni vincular expedientes por correo.

- `GET /api/portal-titular/auth/iniciar`: cookie de transacción cifrada de cinco minutos; `state`, `nonce` y PKCE S256 aleatorios.
- `GET /api/portal-titular/auth/callback`: intercambio de código en Keycloak por TLS. `jose`, dependencia existente, valida firma RS256, issuer público, audiencia del cliente, vigencia, `iat`, `nonce` y `azp` cuando corresponde. No se consulta userinfo ni se toma identidad del cuerpo. Se valida `email_verified === true` estrictamente.
- `GET /api/portal-titular/sesion`: solo nombre, correo y booleano de verificación; nunca sub ni tokens.
- `POST /api/portal-titular/auth/salir`: cierra esta sesión; el botón global solo solicita su cierre si `NUXT_PUBLIC_PORTAL_TITULAR_ENABLED=true`. Usa `NUXT_PUBLIC_API_URL`, credenciales incluidas y un timeout de tres segundos sin reintentos. El cierre antiguo y su navegación continúan ante cualquier error, incluido 404, fallo de red o timeout; se advierte si el cierre de la sesión separada no pudo confirmarse.

La sesión cifra `{actor,exp}` con AES-256-GCM y AAD distinto de la transacción. Usa `__Host-certo-titular`, HttpOnly, Secure, SameSite=Lax y Path=/, sin Domain. Expira al vencer el ID token o a la hora, lo que ocurra antes. No se almacenan access/ID/refresh tokens ni se renueva silenciosamente: «Renovar acceso» vuelve a Keycloak. El callback vuelve a una URL fija y no incorpora tokens o identidad. Los errores vuelven con un código genérico. Solo los 502 generan un registro mínimo: `path` (plantilla de ruta sin query ni claves/referencias), `status` y `durationMs`. No se registran cuerpo, cabeceras, identidad, IP, tokens, excepción ni respuesta de consola; el perímetro debe excluir también el query del callback de sus logs.

Referencias de validación: [OIDC Core, ID Token Validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), [jose jwtVerify](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md). La política TLS y de proxies se detalla abajo.

## Configuración por entorno

Solo en **backend**, por el mecanismo administrado de inyección de secretos. Ninguna variable de secreto lleva `NUXT_PUBLIC_`. No se añade ni modifica un `.env`.

| Variable | Requisito |
|---|---|
| `PORTAL_TITULAR_ENABLED` | `true` habilita las rutas; por omisión responden 503. |
| `PORTAL_TITULAR_CONSOLA_URL` | Origen HTTPS interno, por ejemplo `https://consola-servicios.example.org`; sin path/query/credenciales. El código añade `/api/portal-titular/...`. |
| `PORTAL_TITULAR_HMAC_SECRET` | Clave exclusiva compartida con el adaptador de consola: exactamente 64 caracteres hex minúsculos. Se usa como texto UTF-8, **no** como bytes hex decodificados. Nunca reutilizar la clave del BFF de gestores. |
| `PORTAL_TITULAR_SESSION_KEY` | Secreto aleatorio independiente de al menos 32 caracteres, distinto del HMAC. Se deriva la llave AES con SHA-256. Debe coincidir entre réplicas; rotarlo invalida las cookies. |
| `PORTAL_TITULAR_PUBLIC_URL` | Origen HTTPS público que sirve el backend del portal y su callback; coincide con `NUXT_PUBLIC_API_URL` cuando se usa un origen de API separado. Sin subruta. |
| `FRONTEND_URL` | Origen HTTPS del frontend, sin subruta. Único Origin admitido y destino fijo tras SSO; puede diferir del backend. |
| `KEYCLOAK_PUBLIC_URL` | Issuer exacto del realm; HTTPS. Reutiliza el parámetro del parche 0011. |
| `KEYCLOAK_INTERNAL_URL` | Base del mismo realm para token/JWKS, HTTPS. Si falta se usa el issuer. No reescribe el issuer esperado. |
| `KEYCLOAK_CLIENT_ID` | Cliente confidencial existente, por omisión `certo`. |
| `KEYCLOAK_CLIENT_SECRET` | Secreto de ese cliente, requerido. No se reutiliza para la firma a consola. |
| `PORTAL_TITULAR_TRUST_PROXY` | `false` por omisión. Activa globalmente `server.proxy.koa` solo con `true`; véase la política TLS abajo. No selecciona la IP que se firma. |
| `PORTAL_TITULAR_IP_SOURCE` | `socket` por omisión: ignora todas las cabeceras de IP. Alternativas explícitas: `cf-connecting-ip` o `xff-single`. Un valor desconocido produce 503 al resolver la IP. |
| `PORTAL_TITULAR_TRUSTED_PROXY_IPS` | IPs literales del **par conectado directamente** al backend, separadas por coma; sin CIDR. Coincidencia exacta con `req.socket.remoteAddress`, incluida su representación IPv4 mapeada a IPv6 si corresponde. Solo esos pares pueden aportar la cabecera seleccionada. |

En **frontend**, `runtimeConfig.public.portalTitularEnabled` vale `false` por omisión y se configura con `NUXT_PUBLIC_PORTAL_TITULAR_ENABLED=true`. Es una bandera pública sin secretos, independiente del control del backend: deben habilitarse ambos. Con la bandera apagada no hay enlace en dashboard, contenido de la sección ni llamadas al portal. `NUXT_PUBLIC_API_URL` indica el origen de backend; si está vacío, se usa el mismo origen. Todas las peticiones del portal incluyen credenciales; los enlaces de acceso y renovación usan esa misma base.

Con frontend y API en orígenes distintos, deben compartir **sitio HTTPS** para la cookie `SameSite=Lax` (por ejemplo, dos subdominios del mismo dominio registrable). Para dominios de sitios diferentes, enrutar la API bajo el sitio del frontend; `credentials: include` no anula SameSite y esta implementación no lo relaja. Añadir el origen exacto del frontend a `CORS_ALLOWED_ORIGINS`; CORS permite credenciales e `Idempotency-Key`. El callback y las cookies pertenecen al host de API, mientras que el retorno SSO vuelve a `FRONTEND_URL`. Un GET sin Origin se permite para navegación y callback OIDC; cualquier Origin suministrado debe coincidir con `FRONTEND_URL`, incluso en callback. POST exige ese Origin y rechaza `Sec-Fetch-Site: cross-site`.

El enrutamiento debe entregar `/api/portal-titular/*` a Strapi. Para habilitar se necesita registrar la URI `https://<origen-backend>/api/portal-titular/auth/callback` en el cliente Keycloak existente, conservar el callback antiguo, mapear email y email_verified al ID token, ofrecer verificación de correo y comprobar el mismo sub entre clientes. Estas son instrucciones pendientes, **no acciones ejecutadas**.

## Política de IP, proxy y TLS

La selección de IP es local al portal y a su rate-limit previo de autenticación; no depende de `ctx.ip` ni de `proxy.koa`. No modifica la firma ni el contrato de consola.

- **Default `socket`:** firma y limita por `req.socket.remoteAddress`, aunque existan cabeceras o una lista de proxies. Puede agrupar la cuota de todos los usuarios detrás de un proxy; es la opción conservadora mientras se valida el perímetro.
- **Laboratorio / Cloudflare Tunnel:** seleccionar `cf-connecting-ip` y autorizar únicamente la IP del proceso/contenedor que conecta directamente con Strapi (cloudflared o el último proxy local). Ese trayecto debe aceptar solo tráfico del túnel y conservar el `CF-Connecting-IP` generado por Cloudflare; no basta con recibir una cabecera con ese nombre. No se lee XFF en este modo. Véase [Cloudflare: cabeceras de solicitud](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
- **Instancia oficial / VM de entrada detrás de Fortinet:** seleccionar `xff-single` y autorizar la IP de esa VM tal como la ve el socket de Strapi. La VM debe **reemplazar**, nunca concatenar, `X-Forwarded-For` por una sola IP verificada del cliente. Si Fortinet hace SNAT, hay que verificar cómo obtiene la VM esa IP; no confiar en XFF aportado por Internet ni suponer que la IP del socket de la VM siempre es la del cliente.

En los modos de cabecera, un par no autorizado se limita a su IP de socket. Para un par autorizado, la cabecera elegida debe contener una única IP literal: ausencia, listas, duplicados combinados, puertos o valores inválidos producen 503, sin recurrir a otra cabecera. Una lista de proxies con entradas inválidas también falla cerrada. No se toman cabeceras `X-UDG-Portal-IP` del navegador. Restringir por red el acceso directo a Strapi y verificar los saltos reales antes de configurar confianza.

**`proxy.koa` y cookies Secure:** `PORTAL_TITULAR_TRUST_PROXY=false` mantiene desactivada la confianza global de Koa. Este repo no interpreta una variable genérica `TRUST_PROXY`; el interruptor implementado es `PORTAL_TITULAR_TRUST_PROXY`. Las cookies conservan siempre `Secure`, HttpOnly, SameSite=Lax y el prefijo `__Host-`. Con TLS directo hasta Koa no hace falta activar proxy. Si TLS termina antes y Strapi recibe HTTP, Koa necesita reconocer HTTPS para emitirlas; no se debe quitar `Secure` para eludirlo.

Solo en un backend inaccesible desde pares no confiables se puede habilitar `PORTAL_TITULAR_TRUST_PROXY=true`: el último proxy debe reemplazar `X-Forwarded-Proto` por el esquema externo comprobado y sanear las cabeceras reenviadas. La opción es **global**, no está restringida por `PORTAL_TITULAR_TRUSTED_PROXY_IPS`: altera `ctx.secure`/`ctx.protocol` y `ctx.ip`/`ctx.ips` de otras rutas y puede afectar sus cookies y redirecciones. Validar esas rutas antes de habilitarla. Referencias: [Strapi, configuración de servidor](https://docs.strapi.io/cms/configurations/server) y [Koa, proxy y request](https://koajs.com/).

El middleware `rate-limit` corre antes del portal y de `strapi::errors`. En las rutas del portal ahora usa el mismo selector seguro y convierte la configuración/cabecera inválida en 503. Por ello cambiar XFF no elude su cuota y activar `proxy.koa` no cambia la IP del portal. El rate-limit antiguo de las rutas ajenas al portal conserva su comportamiento previo (lee el primer XFF sin comprobar el par); su seguridad sigue dependiendo del saneamiento del perímetro, incluso con `proxy.koa=false`.

## Contrato exacto de red

Todas las nueve operaciones, incluido el catálogo del adaptador, se firman y requieren una sesión SSO válida en Certo. Base: `PORTAL_TITULAR_CONSOLA_URL`; prefijo: `/api/portal-titular`.

| Método | Ruta tras el prefijo | Cuerpo / resultado |
|---|---|---|
| GET | `/catalogo-publico` | Sin cuerpo; 200 `{data: fichas}`. |
| GET | `/catalogo-publico/:clave` | `encodeURIComponent(clave)`; sin cuerpo, 200 `{data: ficha}`. |
| GET | `/instancias` | Sin cuerpo; 200 `{data: [{clave,nombre,activa}]}`. |
| GET | `/solicitudes-saberes[?pagina=N]` | N entre 1 y 999999, sin ceros iniciales; sin cuerpo. 200 `{data,meta:{pagina}}`; 25 filas. |
| GET | `/solicitudes-saberes/:referencia` | UUID v4 minúscula; sin cuerpo; 200 `{data}`. |
| POST | `/solicitudes-saberes` | Presentación abajo; 201 `{data}`. Requiere Idempotency-Key. |
| POST | `/solicitudes-saberes/:referencia/subsanar` | `{"data":{"descripcionSaberes":"...","evidencias":"..."}}`; 200 `{data}`. |
| POST | `/solicitudes-saberes/:referencia/reapertura` | `{"data":{"motivo":"..."}}`; 200 `{data}`. |
| POST | `/solicitudes-saberes/:referencia/confirmar-correo` | `{"data":{}}`; 200 `{data}`. |

Presentación: `{"data":{"nombreCompleto":"...","claveLogro":"...","instancia":"CLAVE_PUBLICA","descripcionSaberes":"...","matricula":"...","evidencias":"...","fechaLogro":"AAAA-MM-DD","solicitudAnterior":"UUID_PROPIA"}}`. Los últimos cuatro campos son opcionales. `instancia` contiene la clave pública y `solicitudAnterior` la referencia pública; nunca documentId. La referencia anterior debe ser propia, de la misma ficha y con respuesta negativa, condición autorizada por consola. Todos los campos suministrados son cadenas. Para subsanar, evidencias es opcional; la descripción es obligatoria. El proxy no admite campos adicionales.

Cabeceras generadas por Certo:

```text
Accept: application/json
Content-Type: application/json; charset=utf-8   # solo POST
X-UDG-Portal-Version: 1
X-UDG-Portal-Client: portal-titular
X-UDG-Portal-Timestamp: <epoch milisegundos como cadena>
X-UDG-Portal-Nonce: <32 bytes aleatorios en base64url sin padding: 43 caracteres>
X-UDG-Portal-Actor: <actor64>
X-UDG-Portal-IP: <IP de conexión o de proxy expresamente confiable>
Idempotency-Key: <clave aleatoria por presentación; ausente en otras acciones>
X-UDG-Portal-Signature: <64 hex minúsculos>
```

```js
// Todos los elementos de base son cadenas, sin espacios/saltos agregados.
actor64 = Buffer.from(JSON.stringify({ sub, email, email_verified, name }), 'utf8').toString('base64url')
body = method === 'GET' ? '' : JSON.stringify({ data: camposPermitidos })
bodyHash = SHA256(body UTF8).hexMinusculas()
target = '/api/portal-titular/...' // Incluye exactamente ?pagina=N si se suministra.
base = JSON.stringify(['1', 'portal-titular', method, target, bodyHash,
  timestamp, nonce, actor64, ip, idempotencyKey || ''])
signature = HMAC_SHA256(claveComoTextoUTF8, base UTF8).hexMinusculas()
```

El orden que usa el proxy para los campos de presentación es: nombreCompleto, claveLogro, instancia, descripcionSaberes, matricula, evidencias, fechaLogro, solicitudAnterior; omite ausentes. No normaliza el contenido textual. Firma y envía exactamente la misma cadena. No se transmite el hash por separado. `email_verified` dentro del actor es un booleano. La consola acepta los bytes de actor64 tal cual; no requiere ordenar las propiedades del JSON decodificado. Ventana de consola: 60 segundos por omisión. Nonce de petición nuevo incluso al reintentar con la misma Idempotency-Key. Antirrepetición y persistencia de idempotencia corresponden al receptor.

Solo se admite la query de paginación; se rechazan revision, populate, fields, filtros, fecha, interrogación vacía, parámetros repetidos, métodos administrativos, barras finales y rutas ambiguas. No hay Bearer de servicio. El receptor impone titular y comprueba propiedad de cada referencia.

Errores conservados: 400, 401, 403, 404, 409, 413, 429 y 503; fallo de transporte/JSON o estado inesperado → 502. Certo no reenvía el texto bruto del error. En 429 conserva Retry-After numérico en cabecera y `error.retryAfter` para la cuenta regresiva; si falta o es inválido, usa 600 segundos. El navegador conserva el formulario y no hace reintentos automáticos.

## Verificación local reproducible

Node 22.23.3. Las dependencias de comprobación se instalaron solo en `/tmp/certo-portal-check`. No se instaló ni actualizó nada en los package.json/locks del proyecto.

```sh
npm install --prefix /tmp/certo-portal-check --ignore-scripts --no-audit --no-fund --package-lock=false typescript@5 vue@3.5 @vue/compiler-sfc@3.5 @vue/server-renderer@3.5 jose@6 @types/node@22 esbuild playwright
NODE_PATH=/tmp/certo-portal-check/node_modules node scripts/test-portal-titular.cjs
# Opcional: cotejo de firma con el código real del receptor, solo lectura.
NODE_PATH=/tmp/certo-portal-check/node_modules PORTAL_CONSOLE_SOURCE=/home/ruben/Nextcloud/Projects/udgplus/microcredenciales/laboratorio/consola-gestores node scripts/test-portal-titular.cjs
NODE_PATH=/tmp/certo-portal-check/node_modules node scripts/test-portal-titular-browser.cjs
```

La prueba opcional pasó con `PORTAL_CONSOLE_SOURCE=/home/ruben/Nextcloud/Projects/udgplus/microcredenciales/laboratorio/consola-gestores`: el **verificador real de consola** aceptó las nueve firmas de Certo y rechazó alterar la IP firmada. No se inicializan Strapi, dotenv o persistencia. Toda identidad, clave y token del test son sintéticos; los endpoints OIDC se simulan con un JWT RSA real y JWKS de prueba.

Pasaron **25 grupos de pruebas**, incluido el cotejo opcional con consola. Se comprobaron cifrado/caducidad/propósito de cookie, origen, identidad falsificada, rutas/query y cuerpo, firma y alteración, selección socket/CF/XFF y par confiable, rate-limit previo sin bypass por XFF, GET con Origin ajeno, separación de origen frontend/API, log 502 mínimo, idempotencia, Retry-After, proyección, firma/issuer/audiencia/vigencia/nonce/estado/PKCE OIDC, TypeScript y compilación de cuatro SFC, y SSR según estados. `tsc --strict --noEmit` también pasó para los cinco módulos del backend del portal con tipos de dependencias temporales.

Pasaron **ocho grupos de recorridos en Chromium**. El navegador ejecuta los componentes Vue reales en un HTML aislado con API ficticia y tráfico HTTP bloqueado: catálogo, envío, 409 con relectura y texto conservado, envío incierto y reintento idéntico, nueva solicitud vinculada tras consulta asíncrona, cuenta regresiva de Retry-After, correo sin verificar, ausencia de errores JavaScript y ancho móvil; además, enlace/sección ocultos al deshabilitar, destino de API con credenciales y cierre global ante 401/403/404/500/502/503, fallo de red, timeout y error inesperado. El cierre deshabilitado no hace llamadas. Se usan los componentes reales Header y dashboard con sus dependencias ajenas al portal simuladas. Produce capturas en un directorio `/tmp/certo-portal-ui-*`; las capturas de escritorio y teléfono documentan el formulario; las aserciones comprueban las regresiones de seguridad. Esto **no** equivale al layout completo Nuxt ni al sitio desplegado.

## Archivos de este cambio

- `README.md`
- `docs/portal-titular.md`
- `docs/patches/0015-saberes-previos-portal.md`
- `src/backend/config/middlewares.ts`
- `src/backend/config/server.ts`
- `src/backend/src/middlewares/rate-limit.ts`
- `src/backend/src/middlewares/portal-titular.ts`
- `src/backend/src/portal-titular/client-ip.ts`
- `src/backend/src/portal-titular/contract.ts`
- `src/backend/src/portal-titular/session.ts`
- `src/backend/src/portal-titular/transport.ts`
- `src/frontend/nuxt.config.ts`
- `src/frontend/app/components/Header.vue`
- `src/frontend/app/pages/dashboard.vue`
- `src/frontend/app/pages/saberes-previos.vue`
- `src/frontend/app/components/saberes/SolicitudTitular.vue`
- `src/frontend/app/composables/useSaberesPrevios.ts`
- `scripts/test-portal-titular.cjs`
- `scripts/test-portal-titular-browser.cjs`

## Dudas y límites pendientes

- El README compartido cambió durante el trabajo: la primera lectura usaba `/api/...`, documentId y sin idempotencia. La versión v1 publicada después por el lado consola define el prefijo exclusivo, referencias públicas, IP firmada e idempotencia. Este código sigue **esa versión actualizada**, cotejada con su verificador, sin editar el contrato externo.
- Falta comprobar issuer, mismo sub entre clientes, RS256, email_verified, acceso externo y redirect URI del cliente en Keycloak real. El código no cambia Keycloak ni vincula por correo cuentas de clientes con subjects pairwise.
- HTTPS interno a consola y Keycloak es obligatorio. El laboratorio descrito en el parche 0011 usaba HTTP interno: necesita una decisión/configuración de red/TLS antes de habilitar este flujo. No se introdujo una excepción HTTP.
- Es necesario confirmar la IP del par directo, la preservación de CF-Connecting-IP en el laboratorio y el reemplazo de XFF en la VM oficial, incluido el posible SNAT de Fortinet. Si no se configura, la cuota IP corresponde a la conexión directa (posiblemente compartida por varios titulares detrás del proxy).
- Falta el recorrido real SSO → Certo → consola → resolución → emisión → cartera. No se ejecutaron build completo Strapi/Nuxt, arranque/migración de base, concurrencia real, despliegue ni revisión de comprensión con titulares. El plazo y la única reapertura se autorizan y calculan en consola; Certo no fabrica fechas ni concede transiciones.
- Esta sección tiene sesión propia y muestra su correo. Las páginas antiguas mantienen su autenticación anterior; no se afirma haber migrado todas las cookies/localStorage del portal. El cierre desde Header intenta cerrar ambas sesiones. La renovación recarga la sección y no conserva borradores entre recargas.
- La carpeta externa `laboratorio/certo/parches/` está fuera de los directorios de escritura permitidos. El texto de 0015 se conserva dentro de este checkout en `docs/patches/0015-saberes-previos-portal.md`, sin escalar para escribir fuera del alcance.
