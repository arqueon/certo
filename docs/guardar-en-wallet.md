# Guardar en mi wallet

La titular inicia sesión, abre su credencial y pulsa **Guardar en mi wallet**. Si se configura la cartera web recomendada, pulsa **Abrir en Cartera UDGPlus** o escanea su QR desde el celular; **¿Usas Learner Credential Wallet?** despliega el enlace **Abrir en LCW** y su QR alternativo. Los dos usan la misma oferta de un solo uso. Sin cartera web configurada, se conserva el flujo anterior: en una computadora escanea el QR con Learner Credential Wallet (LCW); en el celular pulsa **Abrir en mi wallet**. Certo pide a la cartera una firma de autenticación y le entrega una copia de la credencial cuyo sujeto es el DID de esa cartera. La original sigue intacta y descargable. Implementa la decisión comunicada de ADR 0022, 4 de octubre de 2026.

El enlace y el QR son una autorización temporal: quien los reciba puede reclamar esa copia. No deben compartirse. Caducan a los diez minutos y permiten **un solo canje exitoso**. El QR público de verificación sigue siendo independiente: no da acceso al intercambio.

## Protocolo elegido y fuentes verificadas

Se implementa **VC-API exchanges con una Verifiable Presentation Request (VPR) `DIDAuthentication`**, iniciado mediante la invitación JSON `protocols.vcapi` de LCW. No es OID4VCI. Las referencias se consultaron el **4 de octubre de 2026**; los enlaces al código fijan la revisión y no dependen de futuros cambios de `main`.

| Fuente oficial | Versión o revisión y uso concreto |
| --- | --- |
| [LCW: `walletRequestApi.ts`](https://github.com/digitalcredentials/learner-credential-wallet/blob/0181ea8b1c8ea9c2cdaa73c9e9ccf6cdcfc7c78d/app/lib/walletRequestApi.ts) | Tag **v2.2.9-build103**, commit `0181ea8b1c8ea9c2cdaa73c9e9ccf6cdcfc7c78d`: `request` contiene JSON codificado como parámetro de URL; `protocols.vcapi` identifica el intercambio. No es base64 ni JWT. El repositorio oficial actualmente redirige a OpenWallet Foundation Labs. |
| [LCW: `ExchangeCredentials.tsx`](https://github.com/digitalcredentials/learner-credential-wallet/blob/0181ea8b1c8ea9c2cdaa73c9e9ccf6cdcfc7c78d/app/screens/ExchangeCredentials/ExchangeCredentials.tsx) y [`exchanges.ts`](https://github.com/digitalcredentials/learner-credential-wallet/blob/0181ea8b1c8ea9c2cdaa73c9e9ccf6cdcfc7c78d/app/lib/exchanges.ts) | Mismo tag: POST inicial `{}`, respuesta `verifiablePresentationRequest`, POST `{verifiablePresentation: ...}` a la **misma URL**, recepción `{verifiablePresentation: ...}` y aprobación de las credenciales. |
| [LCW: `composeVp.ts`](https://github.com/digitalcredentials/learner-credential-wallet/blob/0181ea8b1c8ea9c2cdaa73c9e9ccf6cdcfc7c78d/app/lib/composeVp.ts) | Mismo tag: `@digitalcredentials/vc` crea la VP con `holder`; `Ed25519Signature2020` firma con `challenge` **y** `domain`. La suite de la presentación no es la suite de la credencial emitida. |
| [DCC workflow-coordinator: `app.js`](https://github.com/digitalcredentials/workflow-coordinator/blob/ba01b997b33eec10abc5cf44dce50569b0eca6c6/src/app.js) | Commit `ba01b997b33eec10abc5cf44dce50569b0eca6c6`: referencia del canje y de asignar `credentialSubject.id` al holder autenticado antes de firmar. Su flujo heredado usa otra ruta con transactionId y devuelve la VC directamente; ese contrato no se mezcla con el moderno de LCW. |
| [W3C VC-API, hoy VCALM v1.0](https://w3c.github.io/vcalm/#participate-in-an-exchange) | Borrador, commit [`c295ba40303ed0f5da87cd2cefb26cc617284822`](https://github.com/w3c/vcalm/tree/c295ba40303ed0f5da87cd2cefb26cc617284822): participación en intercambios y descubrimiento de protocolos. La antigua URL `w3c-ccg.github.io/vc-api/` redirige; no se afirma implementar todo VCALM. |
| [VPR v2024: DID Authentication](https://w3c-ccg.github.io/vp-request-spec/#did-authentication) | Commit [`1a2769045e388f085036bb231f8f735b60f0b5e5`](https://github.com/w3c-ccg/vp-request-spec/tree/1a2769045e388f085036bb231f8f735b60f0b5e5): query, `acceptedMethods`, holder, challenge y domain. Esta especificación fue incorporada a VCALM. |

**Compatibilidad del cliente que debe comprobarse antes de desplegar:** el último tag encontrado fue v2.2.9-build103, cuyo código guarda la VC recibida después de DIDAuth. En el `main` consultado, versión declarada 2.2.10, commit [`1c46a82ba38447f164998903e88944b67fc2a2e6`](https://github.com/digitalcredentials/learner-credential-wallet/blob/1c46a82ba38447f164998903e88944b67fc2a2e6/app/screens/ExchangeCredentials/ExchangeCredentials.tsx), la condición `!isVPRFlow && acceptCredentials` omite el almacenamiento cuando la primera respuesta es una VPR. La incompatibilidad se deduce directamente de esa condición y del flujo anterior; no se ha ejecutado un binario móvil de esa revisión. No se puede asegurar qué revisión distribuye cada tienda. Probar la versión instalada y comprobar que llega a **aprobar y guardar**; si contiene esta regresión, necesita corrección en LCW. Cambiar el servidor para omitir la autenticación no es una solución válida.

El código actual de LCW también reconoce [`interactionUrl.ts`](https://github.com/digitalcredentials/learner-credential-wallet/blob/1c46a82ba38447f164998903e88944b67fc2a2e6/app/lib/interactionUrl.ts): GET de una URL con `?iuv=1` devuelve `protocols`. Certo ofrece esta variante de descubrimiento; el QR principal usa el enlace universal compatible con el tag anterior.

### Enlaces modernos y heredados

El enlace universal es `https://lcw.app/request.html?request=` seguido de `encodeURIComponent(JSON.stringify({protocols:{vcapi:exchangeUrl}}))`. El deep link alternativo usa `dccrequest://request?request=` con el **mismo** JSON. El QR contiene el enlace universal, no la VC, un token de sesión ni datos del titular.

El esquema `dccrequest://` también se usó en el [flujo heredado documentado por DCC](https://github.com/digitalcredentials/docs/blob/main/request/credential_request.md), con `issuer`, `auth_type`, `vc_request_url` y a veces `challenge`. En LCW, [`present.ts`](https://github.com/digitalcredentials/learner-credential-wallet/blob/1c46a82ba38447f164998903e88944b67fc2a2e6/app/lib/present.ts) firma ese camino sin pasar `domain`, mientras `composeVp.ts` sí lo hace. **Certo no anuncia ni acepta el contrato heredado** sin dominio, ni una VP suelta sin el envoltorio VC-API. Así mantiene la comprobación de dominio solicitada y evita confundir dos protocolos que comparten el mismo esquema de enlaces.

## Rutas y mensajes

Las dos rutas de la titular reutilizan el scope `api::credential.credential.find` y comprueban explícitamente `recipient.owner.id`. Ni otro titular ni el emisor adquieren acceso por disponer de ese scope. El identificador admite el ID numérico, documentId o URN, como `holder-access`.

| Ruta | Contrato |
| --- | --- |
| `POST /api/holder/credentials/:id/wallet-offer` | Dueño autenticado. Body `{}`. Devuelve `{data: {exchangeUrl, walletUrl, deepLink, interactionUrl, qrContent, expiresAt}}`. Devuelve 409 para formato antiguo, firma inválida, revocación, vigencia no válida o emisor ajeno a la instalación. |
| `GET /api/holder/credentials/:id/wallet-copies` | Dueño autenticado. Devuelve elegibilidad, indicación de formato antiguo, `walletCount`, copias con DID/fecha/URN y `revocation: "shared"`. No entrega las copias firmadas. |
| `POST /api/exchanges/:exchangeId` | Público, sin sesión del portal. `{}` devuelve la VPR; `{verifiablePresentation: vp}` autentica y canjea. |
| `GET /api/exchanges/:exchangeId?iuv=1` | Público. Devuelve `{protocols: {vcapi: exchangeUrl}}` para una oferta pendiente y vigente. No consume la oferta. |

No hacen falta una ruta con transactionId, un callback ni una pantalla web pública de la oferta: LCW moderno hace ambos POST a la misma URL. Todas estas respuestas usan `Cache-Control: no-store` (las del dueño también `private`). La respuesta final es una VP sin firma propia que contiene **la VC firmada por el emisor**, como espera LCW.

Este ejemplo es ficticio; los valores repetidos no deben usarse como identificadores reales:

```json
{
  "data": {
    "exchangeUrl": "https://credenciales.example.org/api/exchanges/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "walletUrl": "https://lcw.app/request.html?request=%7B%22protocols%22%3A%7B%22vcapi%22%3A%22https%3A%2F%2Fcredenciales.example.org%2Fapi%2Fexchanges%2Faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%22%7D%7D",
    "deepLink": "dccrequest://request?request=%7B%22protocols%22%3A%7B%22vcapi%22%3A%22https%3A%2F%2Fcredenciales.example.org%2Fapi%2Fexchanges%2Faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%22%7D%7D",
    "interactionUrl": "https://credenciales.example.org/api/exchanges/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?iuv=1",
    "qrContent": "https://lcw.app/request.html?request=%7B%22protocols%22%3A%7B%22vcapi%22%3A%22https%3A%2F%2Fcredenciales.example.org%2Fapi%2Fexchanges%2Faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%22%7D%7D",
    "expiresAt": "2026-10-04T22:10:00.000Z"
  }
}
```

La primera respuesta a POST `{}` tiene este formato. `domain` es **el host público**, con puerto si existe, derivado de configuración; nunca del encabezado Host o X-Forwarded-Host:

```json
{
  "verifiablePresentationRequest": {
    "query": [{
      "type": "DIDAuthentication",
      "acceptedMethods": [{"method": "key"}, {"method": "web"}]
    }],
    "challenge": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "domain": "credenciales.example.org"
  }
}
```

No se fija `acceptedCryptosuites: eddsa-rdfc-2022` en la VPR: LCW 2.2.9 firma DIDAuth con `Ed25519Signature2020`. Se admiten esa suite y `DataIntegrityProof/eddsa-rdfc-2022`, siempre con `proofPurpose: authentication`. Se valida la firma, la autorización de la llave en `authentication`, `verificationMethod.controller === holder`, la identidad del documento DID y la igualdad exacta de challenge/domain. Se exige una única prueba y no se solicitan credenciales preexistentes de la cartera.

`did:key` Ed25519 se resuelve localmente con el driver de DCC. `did:web` usa HTTPS, puerto estándar, resolución DNS a direcciones públicas fijadas para la conexión, sin redirecciones, límite de 64 KiB y timeout de 5 s. No accede a loopback, redes privadas ni direcciones de metadatos. Los contextos JSON-LD son locales y están permitidos explícitamente; no se descargan contextos de la presentación. Los métodos DID admitidos se restringen a llaves Ed25519 en las suites anteriores; aceptar `web` no significa aceptar todos los algoritmos posibles de did:web.

La segunda respuesta tiene la forma `{verifiablePresentation: {"@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiablePresentation"], verifiableCredential: [copiaFirmada]}}`. En la copia cambian únicamente `id`, `credentialSubject.id` y `proof`. Se conservan las fechas de vigencia originales, resultados, logro, evidencia, `identifier` con hash y sal, y **la entrada de estado completa**. La firma nueva usa el did:web y la llave activa existentes del emisor, con `eddsa-rdfc-2022`.

Inexistente, vencido, consumido y presentación inválida producen el mismo HTTP 404 y el mismo cuerpo:

```json
{"error":{"status":404,"message":"Exchange unavailable"}}
```

No se promete tiempo de respuesta constante; se igualan estado, cuerpo y cabeceras funcionales. El limitador puede producir 429 antes de consultar el intercambio, independientemente de su existencia.

## Persistencia, privacidad y revocación

Se añaden dos content-types privados, sin rutas CRUD ni relaciones inversas públicas. Todos sus campos de negocio llevan `private: true` y están ocultos del gestor de contenido. Strapi crea las tablas de forma aditiva; no migra, refirma ni modifica documentos históricos.

| Content-type / tabla | Campos |
| --- | --- |
| `api::wallet-offer.wallet-offer` / `wallet_offers` | `tokenHash` SHA-256 único, `challenge`, `domain`, `expiresAt`, `status` (`pending`, `used`, `expired`), `usedAt`, `ownerId` y relación `credential` many-to-one. |
| `api::wallet-copy.wallet-copy` / `wallet_copies` | `credentialId` URN único, `holderDid`, `boundAt`, `signedCredential`, relación `credential` many-to-one y `offer` one-to-one. |

El identificador del enlace contiene 32 bytes aleatorios en base64url; la base solo guarda su hash. El challenge usa otros 32 bytes independientes. Cada oferta tiene su propio challenge; repetir el POST inicial no lo cambia. Una oferta caducada se marca `expired` cuando se vuelve a consultar; aunque no haya recibido esa consulta, `expiresAt` ya impide usarla. No hay una tarea de purga automática. La política de retención de registros queda a la administración de la instalación.

La comprobación de formato, firma, estado y dueño se repite en el canje. La transición a `used` requiere `status = pending AND expiresAt > ahora`; esa actualización y el registro de la copia se ejecutan en una transacción. Si falla el registro, se revierte el consumo. Dos solicitudes concurrentes pueden calcular una firma, pero solo una persiste y obtiene la copia. Una respuesta perdida después del commit no se reenvía: la titular genera otra oferta. Varias ofertas simultáneas para la misma credencial están permitidas; generar una nueva no invalida las anteriores.

La UI cuenta **DID distintos**, no dispositivos físicos. Muestra cada copia con DID abreviado y fecha; el DID completo queda en el atributo `title`. «Guardada» registra el canje, no confirma almacenamiento dentro de la cartera elegida: la titular aún debe aceptar la copia en la cartera. La interfaz lo recuerda expresamente.

**La revocación es conjunta.** La original y todas sus copias comparten exactamente `credentialStatus.statusListCredential` y `statusListIndex`. El mismo bit revoca todas. No se incluye un botón ni un endpoint para revocar una copia individualmente: hacerlo con este modelo afectaría también a la original. Borrar una copia de LCW no revoca los archivos que se hayan compartido. Una revocación independiente exigiría otra entrada de estado y una decisión de modelo distinta de ADR 0022 tal como fue solicitado aquí.

Los enlaces de oferta son capacidades de acceso. El logger de la aplicación sustituye su ruta por `/api/exchanges/[redacted]`. **El proxy y CDN también deben evitar registrar/cachar esas URLs**; esa configuración externa no se ha modificado. Las copias, DIDs y fechas solo son visibles para el dueño mediante la ruta autenticada.

## Variables y dependencias

**`WALLET_OFFER_TTL_SECONDS`** controla la duración de la oferta: por defecto `600`, entero entre 30 y 3600. Un valor inválido falla al crear una oferta. No requiere un secreto nuevo.

Configuración opcional de la cartera web (frontend Nuxt, también configurable al arrancar el servidor construido):

```dotenv
NUXT_PUBLIC_WALLET_APP_URL=https://cartera-microcredenciales.arqueonautis.org
NUXT_PUBLIC_WALLET_APP_NAME=Cartera UDGPlus
```

`NUXT_PUBLIC_WALLET_APP_URL` no tiene valor por defecto: vacío conserva LCW como única opción. `NUXT_PUBLIC_WALLET_APP_NAME` vale **Cartera UDGPlus** por defecto. Los textos están en español e inglés; se usa «credencial» en el flujo genérico. El botón web se muestra tanto en escritorio como en móvil; los QR se muestran en escritorio. La alternativa LCW se despliega mediante un control nativo accesible con teclado.

El enlace web tiene exactamente este contrato de la integración Freewallet comunicado para esta instalación:

```js
'https://cartera-microcredenciales.arqueonautis.org/#/request?request=' +
  encodeURIComponent(JSON.stringify({ protocols: { vcapi: exchangeUrl } }))
```

El hash contiene `/request?request=...`; no es un parámetro de búsqueda antes del hash. El QR principal codifica ese enlace completo. LCW conserva `https://lcw.app/request.html?request=...`. El backend sigue devolviendo `exchangeUrl`, `walletUrl` y `qrContent` compatibles con LCW; el frontend construye el enlace web a partir de `exchangeUrl`.

### CORS exclusivo para los intercambios

En el **backend**, configurar por separado:

```dotenv
WALLET_ALLOWED_ORIGINS=https://cartera-microcredenciales.arqueonautis.org
```

Acepta varios orígenes separados por comas, con espacios opcionales; cada entrada debe ser un origen HTTP(S) exacto, sin ruta ni barra final. No acepta comodines ni `null`. Por defecto la lista está vacía. La URL pública del frontend no añade automáticamente permisos al backend.

`global::wallet-cors` se ejecuta después del alias `/api/v1/*` y antes del limitador y los errores. Solo actúa sobre `/api/exchanges/*` (incluido el alias normalizado). Responde **204** al preflight `OPTIONS` de un origen autorizado que pida `POST` y solo `Content-Type`; anuncia `POST, OPTIONS` y `Content-Type`. Otros preflights de ese espacio reciben **403**, sin permiso CORS. En los POST, incluso los errores de intercambio, devuelve el origen exacto permitido y `Vary: Origin`. Nunca anuncia `Access-Control-Allow-Credentials`; la cartera debe usar `credentials: 'omit'`. No modifica el canje nativo sin cabecera Origin ni sustituye la autenticación DID o el token temporal.

La configuración existente `strapi::cors` con `CORS_ALLOWED_ORIGINS`, credenciales y métodos generales sigue vigente para las demás rutas; excluye los intercambios para que no sobrescriba su política. **No agregar el origen de la cartera a `CORS_ALLOWED_ORIGINS`**: esa variable sí permite acceso general de navegador. El archivo histórico `src/middlewares/cors-header.ts` anuncia `*`, pero no está registrado en `config/middlewares.ts` y no se activa con este cambio.

### Suites de la presentación

La VPR inicial añade dentro de `query[0]`:

```json
{"type":"DIDAuthentication","acceptedCryptosuites":[{"cryptosuite":"eddsa-rdfc-2022"}],"acceptedMethods":[{"method":"key"},{"method":"web"}]}
```

Se conserva la verificación de **DataIntegrityProof / eddsa-rdfc-2022** y **Ed25519Signature2020** ya presente en la rama. La preferencia anunciada permite a Freewallet elegir eddsa; no elimina la compatibilidad LCW. Ambas suites deben autenticar al holder con el challenge y domain correctos; una firma alterada, un propósito distinto o una llave de otro holder se rechazan. No se añaden dependencias.

Se reutilizan `PUBLIC_URL` (origen público de las URLs y host del dominio; fallback `server.url`), las variables de emisor de [interoperabilidad](interoperabilidad.md), `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_WEBSITE_URL` y marca/idioma del [portal](portal-institucional.md). Usar HTTPS público real al desplegar; HTTP loopback se reserva a QA.

El limitador existente protege todas las URLs `/api/exchanges/*` con un cupo conjunto por IP y las creaciones `/api/holder/credentials/*/wallet-offer` con otro cupo conjunto. Usa `RATE_LIMIT_MAX` (50), `RATE_LIMIT_WINDOW_MS` (900000) y `RATE_LIMIT_WHITELIST`; cambiar de identificador no renueva el cupo. Para determinar la IP usa la lógica de confianza existente: `PORTAL_TITULAR_IP_SOURCE` (por defecto `socket`) y `PORTAL_TITULAR_TRUSTED_PROXY_IPS`. Tras un túnel, configurar la fuente y los proxies de confianza para no agrupar a todos bajo la IP del proxy ni aceptar cabeceras falsificadas. El cupo sigue siendo en memoria **por proceso**; varias réplicas requieren un almacén compartido si se desea un límite global.

Dependencias de producción fijadas: `@digitalcredentials/did-method-key 3.0.0`, `@digitalcredentials/ed25519-signature-2020 7.0.0`, `@digitalcredentials/ed25519-verification-key-2020 3.2.2`, `ed25519-signature-2020-context 1.1.0`, `x25519-key-agreement-2020-context 1.0.0` e `ipaddr.js 2.2.0`. Las bibliotecas DCC ya estaban transitivamente en el entorno de pruebas; ahora están declaradas para producción. La firma de VC reutiliza Digital Bazaar Data Integrity 2.5.0, eddsa-rdfc-2022 1.3.0 y jsonld-signatures 11.6.0. No cambia el proveedor de llaves. `qrcode` ya estaba en el frontend.

## Probar con LCW real

1. Desplegar la rama con sus dependencias de producción y sincronización aditiva de tablas. Confirmar los permisos `credential.find`, el vínculo `recipient.owner` del usuario SSO y que `PUBLIC_URL` sea el origen HTTPS que verá el celular.
2. Desde una red externa, comprobar el DID público `/.well-known/did.json` y una lista `/api/revocation-lists/:id`. Ni el intercambio ni esos recursos públicos deben exigir sesión de Cloudflare Access, cookies del portal o un desafío de navegador. Las rutas `holder/*` sí requieren el JWT de la titular.
3. Instalar LCW, anotar versión/build y revisar la diferencia tag/main descrita arriba. Crear o elegir el perfil de la cartera. La documentación del tag sustituye una suposición sobre las tiendas; no sustituye este ensayo móvil.
4. Usar una credencial ficticia nueva, vigente y no revocada. En la computadora, iniciar sesión como su titular y abrir **Guardar en mi wallet**. Escanear el QR desde LCW. En el celular, generar otra oferta y probar **Abrir en mi wallet**. Los enlaces universales dependen también de la asociación de LCW con iOS/Android.
5. Autorizar la autenticación del perfil y **aprobar/guardar** la credencial recibida. Comprobar que aparece al volver a abrir LCW. Si la aplicación termina diciendo que autenticó pero no muestra la aprobación, comprobar si contiene la regresión indicada.
6. Exportar esa copia desde LCW para inspeccionarla: `credentialSubject.id` debe ser el DID del perfil; `identifier` debe conservar hash y sal; ID nuevo; misma lista e índice de estado. Verificarla en LCW y en `/api/credentials/validate`. La firma válida no garantiza inclusión del emisor en un registro de confianza DCC.
7. Volver al portal: debe aparecer el DID y la fecha. Reusar el mismo QR/enlace debe fallar sin entregar otra credencial. Probar también una oferta vencida y dos ofertas independientes. Otro usuario no debe poder crear ofertas ni consultar esas copias.
8. Revocar **la credencial ficticia original** desde la función del emisor y volver a verificar la copia en LCW con red disponible. Debe figurar revocada. El ensayo implica revocar datos de prueba; no usar una credencial real que deba conservarse vigente.

**Cloudflare (Certo):** si `/api` ya va al backend, **no se requieren nuevas rutas de ingress ni DNS**: todas las rutas nuevas están bajo `/api`. Revisar Access/WAF/caché y la confianza de IP para permitir los POST públicos de LCW. El DID raíz sigue usando la ruta de Nuxt incorporada en PR #19; Certo no añade otro hostname. La publicación de la cartera web en su hostname corresponde a su propio repositorio y despliegue. No se operó Cloudflare ni sinope durante este trabajo.

## Pruebas locales reproducibles

Los comandos usan datos ficticios y `ENV_PATH` inexistente; no necesitan `.env` ni secretos reales. Se requiere Node 22 y las dependencias del lockfile. En entornos con sandbox deben permitirse los subprocesos de pruebas y escuchar en loopback.

```sh
cd src/backend
npm test -- --runInBand
node node_modules/typescript/bin/tsc --noEmit
ENV_PATH=/tmp/certo-no-env XDG_CONFIG_HOME=/tmp/certo-wallet-config STRAPI_TELEMETRY_DISABLED=true npm run build
node scripts/qa/portal-http.cjs --wallet --browser
```

El último comando crea SQLite temporal, desactiva correo y deja Strapi en `127.0.0.1:19337`; imprime la ruta a `browser-fixture.json` sin mostrar sus tokens ficticios. Sin `--browser`, termina al concluir. En otra terminal:

```sh
cd src/frontend
node node_modules/vitest/vitest.mjs run
node node_modules/nuxt/bin/nuxt.mjs build --dotenv /tmp/certo-no-env
NITRO_HOST=127.0.0.1 NITRO_PORT=19300 NUXT_PUBLIC_BRAND_NAME=UDGPlus NUXT_PUBLIC_BRAND_PRIMARY_COLOR='#002d54' NUXT_PUBLIC_API_URL=http://127.0.0.1:19337 NUXT_PUBLIC_WEBSITE_URL=http://127.0.0.1:19300 NUXT_PUBLIC_CATALOG_URL=https://catalog.example.test node .output/server/index.mjs
# Con los dos servidores abiertos, desde otra terminal de frontend:
QA_CHROMIUM=/usr/bin/chromium node scripts/qa-wallet.mjs /tmp/certo-portal-http-XXXXX/browser-fixture.json
```

`wallet-signer.mjs` simula el `composeVp` de LCW con claves Ed25519 nuevas y las bibliotecas DCC estándar. `dcc-local.mjs --core` ejecuta **verifier-core 1.0.0-beta.11** completo con transporte local: mantiene su resolver y los verificadores de firma, estado, vigencia y esquema. `registered_issuer` da false porque la instalación ficticia no se añade a un registro de confianza. No se presenta ese resultado como un emisor registrado.

### QA de la integración Cartera UDGPlus, 4 de octubre de 2026

La integración se probó localmente con el contrato Freewallet proporcionado, firmas reales y bases temporales. No se abrió ni desplegó una instancia real de Freewallet; la aprobación y persistencia dentro de esa aplicación siguen pendientes del ensayo integrado del laboratorio. No se hizo push ni despliegue ni se editaron archivos `.env`.

| Comprobación | Resultado exacto de este cambio |
| --- | --- |
| Backend, Jest completo | **36 suites aprobadas, 1 fallida; 274 pruebas aprobadas, 2 fallidas; 276 total**. Los fallos son de `data-portability` (importación y deduplicación). |
| Baseline en copia temporal de HEAD, `data-portability` | **2 aprobadas, 2 fallidas**: los mismos fallos que en la rama. |
| Frontend, Vitest | **14 archivos, 35 pruebas aprobadas**; incluye URL y QR web, nombre configurable, alternativa LCW y modo sin variable. |
| Backend, `tsc --noEmit` | **Exit 0**, sin diagnósticos. |
| Builds Strapi y Nuxt | **Ambos exit 0**, con dotenv inexistente. |
| Frontend, Nuxt typecheck | **34 diagnósticos**; comparación con una copia temporal de HEAD: exactamente iguales en ubicación y contenido. |
| HTTP real, `portal-http.cjs --wallet --browser` | **83 aserciones wallet + 55 del portal**, todas aprobadas. |
| Chromium con cartera web | **31 aserciones aprobadas**. Canje Data Integrity desde otro origen HTTP local con `credentials: 'omit'`, preflight real y bloqueo fuera de exchanges. |
| Chromium sin cartera web | **24 aserciones aprobadas**. Flujo LCW con Ed25519Signature2020 conservado. |
| Render real | Escritorio **1360 × 1000**, móvil **390 × 844**, español e inglés. Capturas en `/tmp/certo-wallet-web-render/` y `/tmp/certo-wallet-render/`. |
| `git diff --check` | **Exit 0**. |

Las pruebas HTTP comprueban la preferencia anunciada, ambas firmas, dos orígenes separados por comas, ausencia de credenciales, error de canje legible para el origen permitido, rechazo de origen ajeno/método no autorizado/cabecera Authorization, cierre de otras rutas y conservación de CORS del portal. La suite de autenticación prueba challenge/domain equivocados, firma alterada y llave de otro holder con ambas suites. Las pruebas existentes de revocación conjunta, verifier-core, concurrencia y rollback siguen aprobadas.

Para reproducir la variante web, arrancar el mismo servidor Nuxt construido con `NUXT_PUBLIC_WALLET_APP_URL=https://cartera-microcredenciales.arqueonautis.org` además de las variables del ejemplo anterior. Ejecutar:

```sh
QA_CHROMIUM=/usr/bin/chromium QA_WALLET_APP_URL=https://cartera-microcredenciales.arqueonautis.org node scripts/qa-wallet.mjs /tmp/certo-portal-http-XXXXX/browser-fixture.json
```

El arnés backend configura únicamente para QA los orígenes de cartera `https://cartera-microcredenciales.arqueonautis.org` y `http://127.0.0.1:19301`. Chromium levanta y cierra un servidor mínimo en `19301` para probar CORS desde otro origen real; no desactiva la seguridad del navegador. El rechazo de `/api/credentials` produce dos mensajes de consola esperados en esa página de transporte; no hay errores JavaScript en las páginas del portal. El QR se compara por sus módulos de píxeles contra el enlace esperado (los PNG de Node y navegador pueden tener compresión distinta).

Reiniciar Nuxt con `NUXT_PUBLIC_WALLET_APP_URL=''` y ejecutar el comando de Chromium sin `QA_WALLET_APP_URL` reproduce la variante anterior. `wallet-signer.mjs` conserva Ed25519Signature2020 por defecto; `wallet(true)` firma con DataIntegrityProof / eddsa-rdfc-2022.

Archivos de implementación de esta ampliación:

- Frontend: `src/frontend/nuxt.config.ts`, `app/components/HolderWallet.vue`, `app/utils/wallet.ts`, `app/locales/es.json`, `app/locales/en.json`.
- Backend: `src/backend/config/middlewares.ts`, nuevo `src/middlewares/wallet-cors.ts`, `src/api/credential/services/wallet-offer.ts` y comentario de compatibilidad en `src/utils/wallet-presentation.ts` (rutas después del prefijo relativas a backend).
- Pruebas: `src/backend/config/__tests__/middlewares.test.ts`, nuevo `src/backend/src/middlewares/__tests__/wallet-cors.test.ts`, `src/backend/src/utils/__tests__/wallet-presentation.test.ts`, los tres scripts `src/backend/scripts/qa/{portal-http.cjs,wallet-http.cjs,wallet-signer.mjs}`, `src/frontend/app/components/__tests__/HolderWallet.nuxt.spec.ts` y `src/frontend/scripts/qa-wallet.mjs`.
- Documentación: `docs/guardar-en-wallet.md`.

### Resultados anteriores de LCW, 4 de octubre de 2026

Node 22.23.3, bases SQLite temporales, Strapi y Nuxt solo en loopback. Builds con dotenv inexistente; ningún mensaje de correo sale de la instancia. No se hizo push ni despliegue, ni se tocaron sinope, `.env` o secretos reales.

| Comprobación | Resultado exacto |
| --- | --- |
| Backend completo, Jest | **35 suites aprobadas, 1 fallida; 259 pruebas aprobadas, 2 fallidas; 261 total**. Incluye 17 pruebas nuevas de ofertas y autenticación. |
| Baseline de main/HEAD, `data-portability` en copia temporal | **2 aprobadas y 2 fallidas**, las mismas de la rama (importación y deduplicación). Ese servicio y su prueba permanecen intactos. |
| Frontend completo, Vitest | **14 archivos, 33 pruebas aprobadas**, incluidas 5 nuevas del control de wallet. |
| Backend, `tsc --noEmit` | **Exit 0**, sin diagnósticos. |
| Backend, `npm run build` | **Exit 0**, TS y panel completos. |
| Frontend, Nuxt build | **Exit 0**, cliente/servidor completos. |
| Frontend, Nuxt typecheck (adicional) | **34 diagnósticos**, idénticos en contenido y ubicación a la copia temporal de main/HEAD. Ninguno en los archivos nuevos de wallet. |
| HTTP real, `portal-http.cjs --wallet --browser` | **62 aserciones wallet + 55 aserciones del portal**, todas aprobadas. |
| Verifier-core beta.11, copia activa | `valid_signature`, `revocation_status`, `expiration` y esquema OB3: **true**. `registered_issuer`: false, esperado para el emisor ficticio sin registros configurados. |
| Verifier-core beta.11, después de revocar la original | Firma y esquema conservados; **`revocation_status: false`**, también rechazado por Certo. |
| Chromium, `qa-wallet.mjs` | **23 aserciones aprobadas**, sin errores JavaScript de página: escritorio 1360 × 1000, móvil 390 × 844, español/inglés, QR/enlace, renovación, datos del dueño, visitante sin control y actualización tras canje real con cartera simulada. |
| Render real | Capturas revisadas en `/tmp/certo-wallet-render/`: escritorio, dashboard, móvil, canje, caducidad y formato antiguo. Los estados de caducidad y formato antiguo se fuerzan solo en el transporte de esa prueba visual; su rechazo real se prueba contra Strapi. |
| `git diff --check` | **Exit 0**. |

La prueba HTTP verifica además propietario, rechazo de tercero/emisor/anónimo, rechazo de formato antiguo/revocado, descubrimiento, challenge estable, identidad con hash conservada, original inmutable, respuesta uniforme para reutilización/vencimiento/inexistencia, challenge y domain equivocados, VP sin firma, llave distinta del holder, dos canjes simultáneos con un solo ganador y rollback si falla el almacenamiento. Las pruebas unitarias cubren did:web autorizado/no autorizado, contextos no permitidos, propósito incorrecto y cuota compartida por IP.

Los avisos existentes del esquema DCC/AJV (`items`/tuplas) y del mock hoisted de `SimpleToast` no impidieron sus verificaciones. El ensayo en un teléfono **LCW real sigue pendiente de despliegue**; no se presenta el simulador como ese ensayo. La prueba de concurrencia se ejecutó con SQLite, no con un clúster PostgreSQL.

### Archivos

- Backend: nuevos `src/api/credential/controllers/wallet.ts`, `routes/wallet.ts`, `services/wallet-offer.ts`, los dos `content-types/wallet-*/schema.json`, `src/utils/wallet-presentation.ts` y `src/middlewares/access-log.ts` (rutas relativas a `src/backend`). Cambios de integración en `config/middlewares.ts`, `rate-limit.ts`, declaraciones, tipos generados, dependencias y lockfile.
- Frontend: nuevo `app/components/HolderWallet.vue`, `app/utils/wallet.ts`; integración en `HolderDownloads.vue` y el slot de las credenciales **recibidas** de `pages/dashboard.vue`; traducciones es/en. La página `pages/credentials/[id]/index.vue` ya monta `HolderDownloads` exclusivamente con los datos de dueño obtenidos por `useHolderCredential`; reutiliza esa comprobación sin duplicarla.
- Pruebas: `wallet-presentation.test.ts`, `wallet-offer.test.ts`, `HolderWallet.nuxt.spec.ts`, `scripts/qa/wallet-signer.mjs`, `wallet-http.cjs`, integración opcional `--wallet` en `portal-http.cjs` y `src/frontend/scripts/qa-wallet.mjs`. Jest admite los módulos ESM DCC.
- Documentación: este archivo y enlaces de actualización desde los documentos de portal e interoperabilidad.

## Límites del vínculo a la cartera

El vínculo **no impide copiar el archivo**. Identifica el DID que debe probar control cuando un tercero pide una presentación firmada. Ese tercero debe verificar la firma de la presentación, su challenge y domain, y comprobar que el holder autenticado coincide con `credentialSubject.id`. Verificar solo la firma del emisor no prueba quién presenta el archivo. Certo no añade aquí un portal de presentación ante terceros.

El enlace autoriza al primer DID que lo canjee; no certifica que una persona que haya recibido un QR reenviado sea la titular original. La entrega privada, el tiempo corto y el uso único reducen esa exposición. La autenticación móvil y el almacenamiento efectivo necesitan la prueba con LCW real indicada arriba: Chromium y una cartera simulada no sustituyen al dispositivo.

**OID4VCI queda pendiente**, junto con el soporte de clientes que lo requieran. Tampoco se añade revocación individual, una API general de workflows VCALM, migración de credenciales antiguas ni bloqueo de copias de archivos.
