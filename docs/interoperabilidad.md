# Interoperabilidad Open Badges 3.0, VC 2.0 y did:web

La integración posterior **[Guardar en mi wallet](guardar-en-wallet.md)** implementa el intercambio VC-API, la copia vinculada y las pruebas de revocación conjunta. Incluye fuentes fijadas por revisión y una advertencia de compatibilidad del `main` actual de LCW.

Las credenciales OB3 nuevas se firman con `DataIntegrityProof`, cryptosuite `eddsa-rdfc-2022` y `proofValue` multibase. El emisor es un `Profile` identificado por `did:web`. La API de emisión sigue aceptando `expirationDate`; el documento firmado contiene `validUntil`. La fecha de emisión se representa como `validFrom`.

Las credenciales históricas conservan su firma y su copia `signedCredential`. Para incorporarlas a Learner Credential Wallet hay que **reemitirlas**; cambiar su contexto o sustituir el campo `jws` por `proofValue` no convierte una firma existente.

## Variables y rutas

| Variable | Servicio | Comportamiento |
| --- | --- | --- |
| `ISSUER_DID_WEB_HOST` | Backend | Opcional. Host público del emisor, sin esquema ni ruta, por ejemplo `microcredenciales.arqueonautis.org`. Tiene prioridad. Un puerto se codifica como `%3A` en el DID. |
| `PUBLIC_URL` | Backend | URL pública, por ejemplo `https://microcredenciales.arqueonautis.org`. Sigue formando URLs de logros, imágenes locales y listas de estado. Sin host explícito se usa su host para el DID. **No usar la dirección interna de Strapi.** |
| `NUXT_PUBLIC_WEBSITE_URL` | Ambos, cuando proceda | En Nuxt conserva su función de URL pública del portal. En el backend es una alternativa para derivar el DID si falta `PUBLIC_URL`; en último término se usa `server.url`. No se transmite automáticamente entre contenedores. |
| `ISSUER_DID_WEB_PROFILE_ID` | Backend | Opcional. ID numérico del perfil emisor, por ejemplo `9` después de comprobarlo. Si se fija, solo ese perfil puede firmar con el DID y solo sus llaves aparecen en el documento. |
| `NUXT_ISSUER_DID_BACKEND_URL` | Nuxt | Opcional, privada y configurable en runtime. Base del backend que consulta la ruta DID, sin `/api`, por ejemplo `http://backend:1337`. Sin ella se usa `NUXT_PUBLIC_API_URL`. No contiene tokens. |
| `NUXT_PUBLIC_API_URL` | Nuxt | Base existente de la API, sin `/api`. Puede ser la misma URL pública del portal: `/api/issuer/did.json` llegará a Strapi. |

El DID raíz identifica a esta instalación institucional. Sin `ISSUER_DID_WEB_PROFILE_ID`, todas las llaves activas y retiradas de `issuer-key` son métodos del mismo DID; los perfiles emisores comparten esa identidad institucional. No se ofrece separación por DID entre organizaciones independientes. En una instalación con varios emisores que deban permanecer separados, fija el perfil institucional antes de emitir o diseña DIDs por ruta en un cambio posterior. Cambiar el host o excluir perfiles después de emitir puede impedir verificar documentos ya entregados.

| Ruta | Servicio | Respuesta |
| --- | --- | --- |
| `GET /.well-known/did.json` | Nuxt, nueva | DID Document público; consulta al backend, sin credenciales ni envoltorio. `application/did+ld+json`, `Cache-Control: no-store`. |
| `GET /api/issuer/did.json` | Strapi, nueva | Mismo documento público. Solo consulta `id` y `publicKeyJwk` de las llaves; nunca genera llaves ni descifra secretos. |
| `GET /api/revocation-lists/:id` | Strapi, existente | `BitstringStatusListCredential` VC 2.0, firmada con Data Integrity y el mismo issuer DID; `application/vc+ld+json`, `Cache-Control: no-store`. |
| `GET /api/profiles/:id/issuer` y `/api/profiles/:id/keys/:keyId` | Strapi, existentes | Se mantienen para las credenciales históricas. Las nuevas no usan estas URLs como issuer ni verificationMethod. |

**El túnel del laboratorio no necesita cambios:** `/api` y `/uploads` siguen llegando a Strapi; la ruta `/.well-known/did.json` llega a Nuxt. Es necesario desplegar el servidor Nuxt/Nitro, no una exportación estática. La consulta de Nuxt usa configuración de confianza; no construye el destino a partir de cabeceras del visitante. Las rutas DID y de estado deben ser públicas, sin redirección a login ni páginas HTML de Access, y respetar `no-store`.

## Firma, contextos y rotación

El servicio `src/backend/src/utils/data-integrity.ts` usa `@digitalbazaar/data-integrity`, `@digitalbazaar/eddsa-rdfc-2022-cryptosuite` y `jsonld-signatures`. El proveedor existente devuelve una `CryptoKey` Ed25519 a partir del PKCS8 cifrado; un adaptador WebCrypto firma los bytes canónicos sin exportar la parte privada. No cambia el cifrado, la ubicación de la llave ni `ENCRYPTION_KEY`. El proveedor KMS sigue siendo el stub previo, no una integración HSM nueva.

Antes de firmar, se omiten los campos opcionales nulos que devuelve Strapi (por ejemplo, `evidence.narrative`); JSON-LD los ignoraría, pero el esquema JSON de OB3 los rechaza. La normalización solo se aplica a emisiones nuevas.

El document loader tiene una lista local cerrada: VC v2, OB3 3.0.3, Data Integrity v1/v2, Multikey y DID. El contexto OB3 pasa de fixture a recurso de producción importado por TypeScript, incluido también en `dist`. Los otros contextos llegan en paquetes de producción fijados en el lockfile. Un contexto desconocido hace fallar la firma; no hay fallback HTTP ni eliminación silenciosa de términos no definidos.

La conversión pública JWK → Multikey usa `@digitalbazaar/ed25519-multikey`, con prefijo multicodec Ed25519 y base58btc (`z6Mk…`). Los identificadores son `did:web:<host>#key-<issuer-key.id>`. `assertionMethod` y `authentication` incluyen las llaves activas y retiradas. Se conserva la lógica anterior de rotación: borra el secreto retirado, mantiene su fila pública y añade una nueva llave. No se deben borrar esas filas públicas mientras deban verificarse credenciales anteriores. «Retirada» por rotación no significa revocación automática de todas las credenciales que firmó.

Las listas de estado se firman al consultarlas, con la llave activa en ese momento; una credencial puede estar firmada con una llave retirada y su lista con la activa. La verificación comprueba ambas firmas y el bit correspondiente. Un error al leer una lista local no se trata como «no revocada».

## Ejemplo de documento nuevo

Datos ficticios; `proofValue` está abreviado y este ejemplo no es una credencial verificable. `results` se expresa como `result` en OB3; la rúbrica va en `achievement.resultDescription`. Ambos y `awardedDate` conservan el comportamiento de la API existente.

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "urn:uuid:00000000-0000-4000-8000-000000000001",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "name": "Análisis de información",
  "description": "Credencial ficticia de demostración.",
  "issuer": {
    "id": "did:web:credenciales.example.org",
    "type": ["Profile"],
    "name": "Institución de ejemplo",
    "url": "https://example.org"
  },
  "validFrom": "2026-10-03T18:00:00.000Z",
  "validUntil": "2030-10-03T18:00:00.000Z",
  "credentialSubject": {
    "type": ["AchievementSubject"],
    "identifier": [{
      "type": "IdentityObject",
      "identityType": "emailAddress",
      "hashed": true,
      "identityHash": "sha256$0000000000000000000000000000000000000000000000000000000000000000",
      "salt": "00000000000000000000000000000000"
    }],
    "awardedDate": "2026-09-01T00:00:00.000Z",
    "achievement": {
      "id": "https://credenciales.example.org/api/achievements/2",
      "type": ["Achievement"],
      "name": "Análisis de información",
      "description": "Actividad ficticia de demostración.",
      "criteria": {"id": "https://example.org/catalogo/2", "narrative": "Resolver la actividad y demostrar los criterios establecidos."},
      "image": {"id": "https://credenciales.example.org/uploads/insignia.png", "type": "Image"}
    }
  },
  "credentialStatus": {
    "id": "https://credenciales.example.org/api/revocation-lists/3#0",
    "type": "BitstringStatusListEntry",
    "statusPurpose": "revocation",
    "statusListIndex": "0",
    "statusListCredential": "https://credenciales.example.org/api/revocation-lists/3"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "created": "2026-10-03T18:00:00Z",
    "verificationMethod": "did:web:credenciales.example.org#key-4",
    "proofPurpose": "assertionMethod",
    "proofValue": "z…abreviado…"
  }
}
```

El hash y la sal de arriba son marcadores ficticios. En emisión se calcula SHA-256 del correo normalizado seguido por una sal aleatoria, como antes; no se añade correo en claro al sujeto.

## DID Document de ejemplo

La llave de este ejemplo es el vector público 1 de RFC 8032, empleado solo en pruebas. No debe usarse como llave emisora real. Cuando se rota, se añade otro método con otro fragmento; el anterior permanece en los tres arreglos.

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/multikey/v1"],
  "id": "did:web:credenciales.example.org",
  "verificationMethod": [{
    "@context": "https://w3id.org/security/multikey/v1",
    "id": "did:web:credenciales.example.org#key-4",
    "type": "Multikey",
    "controller": "did:web:credenciales.example.org",
    "publicKeyMultibase": "z6MktwupdmLXVVqTzCw4i46r4uGyosGXRnR3XjN4Zq7oMMsw"
  }],
  "assertionMethod": ["did:web:credenciales.example.org#key-4"],
  "authentication": ["did:web:credenciales.example.org#key-4"]
}
```

## Compatibilidad del portal

`verification.ts` verifica Data Integrity contra el documento inmutable y comprueba que sus datos coincidan con los campos guardados. Para emisores locales comprueba además que la llave pertenezca al perfil almacenado. Mantiene el camino JWS anterior, incluidos los formatos históricos de llave pública. La validación de archivos nuevos comprueba firma, fechas y lista de estado; la importación conserva proof, fechas VC 2.0, resultados y fecha del logro.

`holder-access` y `check-recipient` mantienen la comprobación de propietario/identidad; no dependen del tipo de firma. La exportación entrega el original, no la proyección pública. Las vistas públicas siguen retirando proof, hash y sal. Las fechas de ficha, tarjetas, LinkedIn e impresión admiten ambos pares de nombres. El esquema `badge.proof` añade únicamente el campo opcional `cryptosuite`.

Un CLR puede agrupar credenciales antiguas y nuevas sin refirmarlas. **El envoltorio CLR conserva su firma JWS anterior**, mediante `generateLegacyProof`; este cambio no lo convierte en un CLR interoperable con LCW. Para probar LCW, importa la credencial OB3 individual. No hay migración masiva, refirma ni modificación de perfiles históricos.

## Pruebas reproducibles

Desde `src/backend`: `npm ci`, `npm test -- --runInBand`, `npx tsc --noEmit` y `npm run build`. Desde `src/frontend`: `pnpm install --frozen-lockfile`, `pnpm test:unit` y `pnpm build`. Para omitir cualquier `.env` en builds de QA, usa `ENV_PATH=/tmp/certo-no-env XDG_CONFIG_HOME=/tmp/certo-interop-config STRAPI_TELEMETRY_DISABLED=true npm run build` en backend y `pnpm exec nuxt build --dotenv /tmp/certo-no-env` en frontend.

Las pruebas `data-integrity.test.ts` incluyen el vector multibase conocido, contextos sin red, firma/verificación, alteración de claims, vigencia, revocación, lista manipulada, autorización del método y conservación de llaves anteriores. `scripts/qa/dcc-local.mjs` se ejecuta en Node desde Jest con las versiones de `@digitalcredentials/vc`, suite y Bitstring usadas por verifier-core. Además, su modo `--core` ejecuta **verifier-core 1.0.0-beta.11 completo**: su loader no admite inyección pública, por lo que se sustituye únicamente `fetch` con documentos ficticios en memoria. Su resolver did:web, contextos, firmas, estado y validación de esquema permanecen intactos; cualquier URL no prevista falla sin red.

Para QA HTTP real: después del build backend, ejecuta `node scripts/qa/portal-http.cjs` desde `src/backend`. Crea SQLite temporal, secretos efímeros y desactiva correos; verifica también rotación, las URLs históricas y un CLR mixto. `--browser` deja la instancia en loopback e imprime la ruta de la fixture para `src/frontend/scripts/qa-portal.mjs`. Las fixtures y tokens de QA se quedan en `/tmp`; no se guardan en el repositorio.

Los contextos y el esquema se contrastaron con sus fuentes el 3 de octubre de 2026 (fecha local). SHA-256 del JSON formateado en el repositorio:

- [Contexto OB3 3.0.3](https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json): `3d34f4d4ef1bce691106e63798beb5e7b862ba841423f5ee1e53ab7ddf3bca84`.
- [Esquema OB3 VC 2.0](https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json), usado solo en tests: `32db9a9f7fb93b447fd44a1b34097df42e0ed8bc4666ad408c31fc2e04cc292a`.

## Después de desplegar

1. Reconstruye backend y frontend con sus lockfiles. Respalda la base y conserva las llaves existentes y `ENCRYPTION_KEY`. Permite que Strapi añada `proof.cryptosuite`; no se cambia la tabla ni el cifrado de llaves.
2. Configura `PUBLIC_URL` y `NUXT_PUBLIC_WEBSITE_URL` con `https://microcredenciales.arqueonautis.org`. Puedes fijar `ISSUER_DID_WEB_HOST=microcredenciales.arqueonautis.org` y, tras comprobar el perfil, `ISSUER_DID_WEB_PROFILE_ID=9`. Configura `NUXT_ISSUER_DID_BACKEND_URL` solo si Nuxt necesita consultar la API por su dirección interna.
3. Comprueba sin sesión `/.well-known/did.json`, `/api/issuer/did.json` y la URL de lista indicada por una credencial. Deben devolver JSON, las cabeceras descritas y el host público correcto. El DID puede estar vacío antes de la primera emisión si el perfil aún no tiene llave; leerlo no crea una.
4. Emite una credencial ficticia nueva desde la consola, con `expirationDate`, resultados y `awardedDate`. Descarga su JSON como titular y comprueba que usa `validFrom`, `validUntil`, dos contextos oficiales, issuer DID y Data Integrity.
5. Instala las devDependencies backend en el equipo de QA y ejecuta, desde la raíz del repo:

   ```sh
   node scripts/qa/verificar-dcc.mjs /ruta/credencial.json
   # Alternativa: URL accesible que devuelva el documento firmado completo
   node scripts/qa/verificar-dcc.mjs https://ejemplo.org/credencial-de-prueba.json
   ```

   El script usa verifier-core real por red. Devuelve exit 0 si verifica firma, vigencia y estado y no detecta un incumplimiento de esquema; exit 1 ante fallos. Muestra por separado los resultados de esquema y registro. Con `knownDIDRegistries: []`, `registered_issuer=false` es esperable: poseer una firma válida no inscribe automáticamente a la institución en un registro de confianza. No acepta la proyección pública sin proof como sustituto del archivo original.
6. Prueba la importación en Learner Credential Wallet y repite la verificación después de revocar la credencial ficticia. Confirma también una histórica en el portal. Para una prueba de rotación, usa primero un perfil de QA: la llave pública anterior debe seguir en el DID y las dos credenciales deben verificar. No hace falta rotar la llave real al desplegar este cambio.

No se ha ejecutado esta lista contra el laboratorio ni contra un teléfono. El resultado local verifica el formato y el código de DCC; la conectividad HTTPS, caché pública y experiencia LCW se comprueban al desplegar.

## Learner Credential Wallet: archivo y deep link

Como titular, descarga el JSON original desde el portal. En LCW, abre **Add Credential / Import**, elige archivo si tu versión ofrece esa opción, o pega el contenido JSON completo en la opción de importar texto. Si la exportación se obtuvo directamente de la API como `{ "data": ... }`, importa solo el objeto `data`; la descarga del portal ya lo extrae. La [guía de DCC](https://github.com/digitalcredentials/docs/blob/main/deployment-guide/DCCDeploymentGuide.md) describe importación por texto y URL; LCW no puede completar el login del portal al descargar una URL protegida.

El deep link de DCC abre un **intercambio de credenciales**, no una página HTML ni nuestro endpoint autenticado `/export`. Su forma documentada es:

```text
https://lcw.app/request.html?issuer=<host>&auth_type=bearer&challenge=<desafio>&vc_request_url=<URL-HTTPS-del-intercambio-codificada>
```

Ese es el flujo heredado documentado por [workflow-coordinator de DCC](https://github.com/digitalcredentials/workflow-coordinator). PR #19 no añadía un servicio de intercambio y se probó mediante importación de archivo/texto. La integración posterior [Guardar en mi wallet](guardar-en-wallet.md) usa el contrato moderno `request`/`protocols.vcapi`, autentica con challenge y domain y firma una copia con un sujeto vinculado. No coloques JWT de sesión en ninguno de estos enlaces.

## Resultados de QA de esta rama

Ejecución local del 3 de octubre de 2026, Node 22.23.3. Sin laboratorio, sin cambios de infraestructura, sin `.env` ni secretos reales.

| Comprobación | Resultado |
| --- | --- |
| Backend, `npm test -- --runInBand` | **33 suites aprobadas, 1 fallida; 242 pruebas aprobadas, 2 fallidas; 244 total**. |
| Baseline de `HEAD`, `data-portability.test.ts` en copia temporal | **2 aprobadas, 2 fallidas**, las mismas que la rama. Fallan la importación y la deduplicación de credenciales; no se cambió ese servicio ni su test. |
| Backend, `tsc --noEmit` | **Sin diagnósticos**. |
| Backend, `npm run build` con `ENV_PATH` inexistente | **Compilación TS y panel completas**. |
| Frontend, `vitest run` | **13 archivos, 28 pruebas aprobadas**. |
| Frontend, `nuxt build --dotenv /tmp/certo-no-env` | **Build cliente/servidor completo**. |
| HTTP Strapi real, SQLite temporal | **55 aserciones aprobadas**: emisión, acceso, privacidad, exportación, DID, content-types, estado, rotación, JWS histórico y CLR mixto. |
| HTTP Nuxt/Strapi para `did.json` | **7 aserciones aprobadas**, con las dos llaves tras la rotación y las cabeceras correctas. |
| Chromium sobre el build y titular ficticio | **33 aserciones aprobadas**: descarga original, verificación por archivo, privacidad, ficha e impresión con emisión/vencimiento visibles. Sin errores JavaScript de página. |
| Documento emitido por Strapi real → verifier-core beta.11 | **5 aserciones aprobadas**: sin errores fatales; firma, estado y vigencia verdaderos; esquema OB3 válido. Resolver/loader reales con transporte local simulado. |
| PDF de Chromium, Poppler y revisión visual | **1 página A4**, 594.96 × 841.92 puntos. Fecha de emisión, logro, vencimiento, rúbrica, insignia y QR legibles. |
| `git diff --check` | Sin errores. |

El schema-check de DCC produce avisos de Ajv sobre la definición de tuplas `@context` del esquema oficial; el documento verifica y el resultado del esquema es `valid: true`. Vitest conserva el aviso previo de mock hoisted en `SimpleToast.nuxt.spec.ts`. No se ejecutó LCW en móvil: la prueba real de importación queda para después del despliegue.


## Archivos de la implementación

El contexto OB3 se trasladó de `src/backend/src/utils/__tests__/fixtures/ob3-context.json` al directorio de contextos de producción. El resto de cambios está en estos archivos:

- [docs/interoperabilidad.md](../docs/interoperabilidad.md)
- [docs/portal-institucional.md](../docs/portal-institucional.md)
- [scripts/qa/verificar-dcc.mjs](../scripts/qa/verificar-dcc.mjs)
- [src/backend/jest.config.js](../src/backend/jest.config.js)
- [src/backend/package-lock.json](../src/backend/package-lock.json)
- [src/backend/package.json](../src/backend/package.json)
- [src/backend/scripts/qa/dcc-local.mjs](../src/backend/scripts/qa/dcc-local.mjs)
- [src/backend/scripts/qa/portal-http.cjs](../src/backend/scripts/qa/portal-http.cjs)
- [src/backend/src/api/clr/services/clr.ts](../src/backend/src/api/clr/services/clr.ts)
- [src/backend/src/api/credential/services/__tests__/interop-fixture.ts](../src/backend/src/api/credential/services/__tests__/interop-fixture.ts)
- [src/backend/src/api/credential/services/__tests__/recipient-issuance.test.ts](../src/backend/src/api/credential/services/__tests__/recipient-issuance.test.ts)
- [src/backend/src/api/credential/services/credential.ts](../src/backend/src/api/credential/services/credential.ts)
- [src/backend/src/api/credential/services/open-badge.ts](../src/backend/src/api/credential/services/open-badge.ts)
- [src/backend/src/api/credential/services/verification.ts](../src/backend/src/api/credential/services/verification.ts)
- [src/backend/src/api/profile/controllers/issuer-did.ts](../src/backend/src/api/profile/controllers/issuer-did.ts)
- [src/backend/src/api/profile/routes/issuer-did.ts](../src/backend/src/api/profile/routes/issuer-did.ts)
- [src/backend/src/api/revocation-list/controllers/revocation-list.ts](../src/backend/src/api/revocation-list/controllers/revocation-list.ts)
- [src/backend/src/api/revocation-list/services/revocation-list.ts](../src/backend/src/api/revocation-list/services/revocation-list.ts)
- [src/backend/src/components/badge/proof.json](../src/backend/src/components/badge/proof.json)
- [src/backend/src/types/data-integrity.d.ts](../src/backend/src/types/data-integrity.d.ts)
- [src/backend/src/types/digitalbazaar-vc-bitstring-status-list.d.ts](../src/backend/src/types/digitalbazaar-vc-bitstring-status-list.d.ts)
- [src/backend/src/utils/__tests__/data-integrity.test.ts](../src/backend/src/utils/__tests__/data-integrity.test.ts)
- [src/backend/src/utils/__tests__/fixtures/ob3-vc2-schema.json](../src/backend/src/utils/__tests__/fixtures/ob3-vc2-schema.json)
- [src/backend/src/utils/contexts/ob3-v3.0.3.json](../src/backend/src/utils/contexts/ob3-v3.0.3.json)
- [src/backend/src/utils/credential-context.ts](../src/backend/src/utils/credential-context.ts)
- [src/backend/src/utils/data-integrity.ts](../src/backend/src/utils/data-integrity.ts)
- [src/backend/src/utils/issuer-did.ts](../src/backend/src/utils/issuer-did.ts)
- [src/backend/src/utils/signed-content.ts](../src/backend/src/utils/signed-content.ts)
- [src/backend/types/generated/components.d.ts](../src/backend/types/generated/components.d.ts)
- [src/frontend/app/api/__tests__/api-client.spec.ts](../src/frontend/app/api/__tests__/api-client.spec.ts)
- [src/frontend/app/api/api-client.ts](../src/frontend/app/api/api-client.ts)
- [src/frontend/app/components/BadgeVerifier.vue](../src/frontend/app/components/BadgeVerifier.vue)
- [src/frontend/app/components/CertificateCard.vue](../src/frontend/app/components/CertificateCard.vue)
- [src/frontend/app/pages/credentials/[id]/imprimir.vue](../src/frontend/app/pages/credentials/[id]/imprimir.vue)
- [src/frontend/app/pages/credentials/[id]/index.vue](../src/frontend/app/pages/credentials/[id]/index.vue)
- [src/frontend/app/types/openbadges.ts](../src/frontend/app/types/openbadges.ts)
- [src/frontend/nuxt.config.ts](../src/frontend/nuxt.config.ts)
- [src/frontend/scripts/qa-portal.mjs](../src/frontend/scripts/qa-portal.mjs)
- [src/frontend/server/routes/.well-known/did.json.get.ts](../src/frontend/server/routes/.well-known/did.json.get.ts)
