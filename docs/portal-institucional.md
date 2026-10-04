# Portal institucional y privacidad del titular

La emisión nueva usa ahora did:web, VC 2.0 y Data Integrity `eddsa-rdfc-2022`. Variables, rutas públicas, compatibilidad histórica y pruebas con DCC/LCW están en [Interoperabilidad](interoperabilidad.md). Las secciones de firmas y comprobaciones del 3 de octubre de este documento registran el estado del PR #18, anterior a ese cambio.

Desde ADR 0022, **[Guardar en mi wallet](guardar-en-wallet.md)** añade el canje de un solo uso con autenticación de cartera, copia vinculada al DID y revocación compartida. Ese documento fija las versiones compatibles de LCW y la prueba móvil pendiente.

Con una variable `NUXT_PUBLIC_BRAND_*` no vacía, Certo funciona como portal del titular y verificador público. UDGPlus emite desde su consola externa; esta portada no ofrece diseñar ni emitir credenciales. Sin marca, se conserva la portada de origen. Las protecciones del backend se aplican siempre, aunque un cliente no use esta interfaz.

## Configuración pública

| Variable | Comportamiento |
| --- | --- |
| `NUXT_PUBLIC_CATALOG_URL` | **Nueva**, URL HTTP(S) del catálogo. Sin URL válida se ocultan la entrada de portada y el enlace del menú. |
| `NUXT_PUBLIC_BRAND_NAME`, `NUXT_PUBLIC_BRAND_LOGO_URL`, `NUXT_PUBLIC_BRAND_PRIMARY_COLOR` | Existentes. Cualquiera no vacía activa el portal institucional. El color debe tener formato hexadecimal de seis dígitos. Si no se proporciona logo, se muestra el nombre de la marca. |
| `NUXT_PUBLIC_DEFAULT_LOCALE` | Existente. Sin valor: español con marca, inglés sin marca. Una elección guardada en `certo_locale` tiene prioridad. |
| `NUXT_PUBLIC_DETECT_BROWSER_LOCALE` | Existente. Sin valor: no detectar con marca; detectar sin marca. `true` y `false` explícitos tienen prioridad. |
| `NUXT_PUBLIC_WEBSITE_URL`, `NUXT_PUBLIC_API_URL` | Existentes. Deben apuntar a las URLs públicas correctas; la primera forma el enlace y QR de verificación. |

Se usan valores de runtimeConfig: también funcionan al arrancar el contenedor. No se modificó ningún `.env`. No se añadió ninguna dependencia de producción; `qrcode` ya existía. Se añadió `vue-tsc` como dependencia de desarrollo para hacer reproducible el typecheck.

## Acceso y comportamiento

- Visitante: Inicio, Verificar, Catálogo si está configurado e Iniciar sesión.
- Titular autenticado: además, Mis credenciales y Saberes previos. La disponibilidad interna de saberes sigue dependiendo de su configuración existente.
- Emisor: Panel de control y Emitir se muestran con `authStore.isIssuer`, la lógica existente basada en `profileType`.
- El verificador acepta identificadores y URLs completas de `/credentials/:id`, `/api/credentials/:id/verify` y `/verify/:id`. También acepta archivos `.json` y `.jsonld`.
- La página pública enlaza la ficha mediante `achievement.criteria.url`; admite también `credentialSubject.achievement.criteria.id` de OB3.
- El dueño encuentra descargas y privacidad en la credencial; desde Mis credenciales puede abrir esos controles y exportar sus historiales existentes.
- `/credentials/:id/imprimir` es una vista del dueño. Incluye insignia cuando existe, datos, fechas, resultados, URL y QR. «Descargar PDF» invoca la impresión del navegador y explica cómo guardar un PDF. El CSS fija A4 y permite continuar en otra página si hay muchos resultados.
- Las cadenas nuevas tienen español e inglés. Los demás idiomas recurren a inglés para las cadenas institucionales nuevas.

El contraste del botón se calcula eligiendo blanco o negro sobre el color de marca opaco. La prueba recorre 125 colores y exige al menos 4.5:1, conforme a [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Se comprobaron también los estilos computados del botón con la clase clara y oscura.

## Contrato del backend

| Ruta | Función y autorización |
| --- | --- |
| `GET /api/credentials/:id/holder` | **Nueva**. Datos completos para el dueño autenticado; comprueba `recipient.owner.id`. |
| `PUT /api/credentials/:id/privacy` | **Nueva**. Solo el dueño; admite exclusivamente los dos booleanos de privacidad en `data`. Otro titular y el emisor reciben 403. |
| `GET /api/holder/clrs` | **Nueva**. Exporta documentos CLR ya existentes cuyo sujeto pertenece al usuario y cuyas credenciales también le pertenecen. No emite un historial nuevo. |
| `GET /api/credentials/:id/export` | Existente. Descarga OB3 del dueño, incluso con enlace desactivado. Se conserva la exportación del emisor propietario cuando la credencial es pública y el nombre está visible. |
| `POST /api/achievements` | Existente. Acepta `criteria: { narrative, url }` y devuelve el componente. Verificado contra Strapi real. |
| `POST /api/credentials/validate` | Existente. Verifica el archivo que aporta la persona sin depender de la visibilidad del enlace. |

Las nuevas rutas autenticadas reutilizan el scope `api::credential.credential.find`, pero ejecutan una comprobación propia de dueño; disponer del permiso del rol no basta. No heredan la excepción de perfiles antiguos sin dueño.

Ejemplo de cambio de privacidad:

```json
{
  "data": {
    "publicRecipientName": false,
    "publicLinkActive": true
  }
}
```

Campos aditivos en `credential`:

| Campo | Tipo y valor inicial |
| --- | --- |
| `publicRecipientName` | Booleano, `true`. Ausente también se interpreta como visible. |
| `publicLinkActive` | Booleano, `true`. Ausente también se interpreta como activo. |
| `signedCredential` | JSON privado, sin valor inicial. Conserva el documento OB3 que se devolvió al emitir una credencial nueva o el archivo validado que se importó. |

Los PUT/POST genéricos de credenciales no permiten escribir estos campos: la privacidad pasa por la ruta del dueño y la copia firmada se escribe internamente.

Al ocultar el nombre, las respuestas públicas son una proyección para mostrar información: dicen «Titular verificado por UDGPlus» y no incluyen identidad del sujeto, correo, evidencia individual ni JWS que pudiera revelar el contenido original. La firma se verifica **antes** de construir esa proyección; la proyección no se presenta como un archivo firmado descargable. El SVG también respeta la opción.

Desactivar el enlace produce 404 en detalle, verificación por identificador y ambas rutas de imagen. El listado público por achievement filtra esas credenciales. Las consultas públicas de evidencias excluyen las asociadas a credenciales restringidas; el dueño y el emisor conservan su consulta autenticada. El catálogo por emisor usa un populate explícito que no incluye credenciales. Las relaciones inversas de credenciales en achievement, profile y evidence son privadas para impedir que `populate` salte estas restricciones. La lista autenticada de credenciales se limita a perfiles con propietario explícito. Los CLR públicos se bloquean si contienen alguna credencial con enlace desactivado o nombre oculto; el dueño conserva su exportación.

Las respuestas de detalle, verificación, imágenes, páginas de credencial y tarjetas Open Graph no deben quedar en caché. Se añadieron cabeceras `no-store`. Esto no retira copias o vistas previas descargadas antes del cambio.

## Firmas y datos anteriores

La emisión nueva incluye `criteria.id = criteria.url`, además de `narrative`, y conserva el documento completo para descargas posteriores. Cambiar la privacidad no modifica la firma ni ese documento; la prueba HTTP compara el objeto exportado antes y después.

No hay migración ni refirma de credenciales anteriores. Para las que carecen de `signedCredential`, se conserva la serialización previa y no se añade `criteria.id` a una credencial ya firmada. El sistema anterior no guardaba una copia inmutable del documento OB3 completo: no se puede recuperar retrospectivamente un archivo original perdido a partir de esta modificación. Su ficha sigue accesible mediante el componente `criteria.url` poblado.

La descarga contiene los datos originales aunque se oculte el nombre público. El texto de privacidad lo explica. En PR #18, «Guardar en mi wallet» solo explicaba la importación de archivo; el [canje de ADR 0022](guardar-en-wallet.md) sustituye ese texto por la integración con LCW.

## Comprobaciones locales del 3 de octubre de 2026

Se usaron Node 22.23.3, dependencias fijadas del repositorio y datos ficticios en SQLite temporal. Nuxt y Strapi escucharon solo en loopback. Se desactivó el envío de correo del servidor de prueba. No se usó Keycloak real ni se contactó al laboratorio para emitir o cambiar datos.

| Comprobación | Resultado |
| --- | --- |
| Frontend, `vitest run` | **12 archivos, 23 pruebas aprobadas**. |
| Backend, `npm test -- --runInBand` | **29 suites aprobadas, 1 fallida; 205 pruebas aprobadas, 2 fallidas; 207 total**. Las 24 pruebas nuevas de privacidad y exportación pasan. |
| Backend original de `HEAD`, suite `data-portability` | Reproduce las mismas **2 fallidas y 2 aprobadas**. No se cambió ese servicio ni su prueba. |
| Backend, `tsc --noEmit` | **Exit 0**, sin diagnósticos. |
| Backend, `npm run build` | **Exit 0**, TypeScript y panel compilados. `ENV_PATH` apunta a un archivo inexistente y la configuración de Strapi a `/tmp`. |
| Frontend, `nuxt build --dotenv /tmp/certo-no-env` | **Exit 0**, build cliente/servidor completo. |
| Frontend, `nuxt typecheck --dotenv /tmp/certo-no-env` | **Exit 1**, 32 diagnósticos heredados. La copia de `HEAD` produce 35 con el mismo verificador. Se corrigieron los de Header, parámetro de credencial y variable `jwt` del retorno OAuth. |
| `node scripts/qa/portal-http.cjs --browser` desde backend | **31 comprobaciones aprobadas** contra HTTP real de Strapi: criteria, propiedad, privacidad, firma, descarga, evidencias, catálogo por emisor, populate y CLR. |
| `node scripts/qa-portal.mjs <fixture>` desde frontend | **31 comprobaciones aprobadas** en Chromium contra el build y backend locales: visitante/titular/emisor, móvil, idioma, catálogo, verificación por enlace y archivo, descargas, privacidad e impresión. Sin errores JavaScript de página. |
| `node scripts/qa-portal-config.mjs` desde frontend | **17 comprobaciones aprobadas**: sin marca, marca sin catálogo, idioma explícito y detección explícita del navegador. |
| E2E existentes, Chromium sobre el build sin marca | **5 aprobadas, 1 fallida** (`about.spec.ts`: busca un texto «About» visible). El mismo caso falla en la copia original de `HEAD`. Firefox no se ejecutó. |
| Impresión real de Chromium y Poppler | **1 página A4, 594.96 × 841.92 puntos**. PNG revisado: insignia, titular, fechas, rúbrica, QR y URL legibles, sin cortes. |
| `git diff --check` | **Exit 0**. |

Los E2E existentes se ejecutaron con un archivo de configuración temporal para reutilizar el build local, sin modificar su configuración original. Las imágenes, PDF de QA y archivos de ejemplo quedaron en `/tmp/certo-portal-render`; contienen únicamente datos ficticios.

Los fallos heredados de tipos se concentran en emisión, login, registro, asignaciones opcionales de perfil y dos propiedades del head de Nuxt. También subsiste un aviso previo de mock hoisted en `SimpleToast.nuxt.spec.ts`.

## Revisión antes de desplegar

1. Configurar la URL real del catálogo y comprobar las URLs públicas usadas para QR y API.
2. Permitir la sincronización aditiva del esquema de Strapi con respaldo normal de la base. No hace falta refirmar ni editar credenciales anteriores.
3. Confirmar que el rol del titular tiene `api::credential.credential.find` y `api::credential.credential.export`, y que su perfil receptor está vinculado mediante `owner` al usuario SSO correcto. No conceder permisos de emisión al titular.
4. Probar el retorno real de Keycloak. Aquí se corrigió la referencia a `jwt` por `response.jwt`, pero la integración con el proveedor real no se ejercitó.
5. Revisar las reglas de caché del proxy/CDN y retirar las vistas previas antiguas cuando corresponda. Un enlace desactivado no puede borrar archivos ya descargados ni la caché de una red social.
6. Probar con una credencial histórica y una nueva, y con un CLR real existente. Las pruebas locales verifican el contrato, no los datos del laboratorio.

No se hizo commit, push ni despliegue. No se tocó sinope, `.env` ni credenciales reales.

## Inventario de archivos modificados o nuevos

Las páginas `verify.vue` y `saberes-previos.vue` se leyeron; sus cambios de vocabulario o navegación se resuelven en los componentes y traducciones compartidos. `verification.ts` ya poblaba `achievement.criteria`; se comprobó su respuesta real sin modificarlo.

### Documentación y función Open Graph

- [`README.md`](../README.md)
- [`docs/portal-institucional.md`](../docs/portal-institucional.md)
- [`netlify/functions/og-credential/og-credential.tsx`](../netlify/functions/og-credential/og-credential.tsx)

### Backend

- [`src/backend/scripts/qa/portal-http.cjs`](../src/backend/scripts/qa/portal-http.cjs)
- [`src/backend/src/api/achievement/content-types/achievement/schema.json`](../src/backend/src/api/achievement/content-types/achievement/schema.json)
- [`src/backend/src/api/achievement/controllers/achievement.ts`](../src/backend/src/api/achievement/controllers/achievement.ts)
- [`src/backend/src/api/clr/controllers/clr.ts`](../src/backend/src/api/clr/controllers/clr.ts)
- [`src/backend/src/api/clr/routes/clr-authenticated.ts`](../src/backend/src/api/clr/routes/clr-authenticated.ts)
- [`src/backend/src/api/credential/content-types/credential/schema.json`](../src/backend/src/api/credential/content-types/credential/schema.json)
- [`src/backend/src/api/credential/controllers/__tests__/holder-privacy.test.ts`](../src/backend/src/api/credential/controllers/__tests__/holder-privacy.test.ts)
- [`src/backend/src/api/credential/controllers/credential.ts`](../src/backend/src/api/credential/controllers/credential.ts)
- [`src/backend/src/api/credential/routes/credential-authenticated.ts`](../src/backend/src/api/credential/routes/credential-authenticated.ts)
- [`src/backend/src/api/credential/services/certificate.ts`](../src/backend/src/api/credential/services/certificate.ts)
- [`src/backend/src/api/credential/services/credential.ts`](../src/backend/src/api/credential/services/credential.ts)
- [`src/backend/src/api/credential/services/holder-access.ts`](../src/backend/src/api/credential/services/holder-access.ts)
- [`src/backend/src/api/credential/services/open-badge.ts`](../src/backend/src/api/credential/services/open-badge.ts)
- [`src/backend/src/api/evidence/content-types/evidence/schema.json`](../src/backend/src/api/evidence/content-types/evidence/schema.json)
- [`src/backend/src/api/evidence/controllers/evidence.ts`](../src/backend/src/api/evidence/controllers/evidence.ts)
- [`src/backend/src/api/profile/content-types/profile/schema.json`](../src/backend/src/api/profile/content-types/profile/schema.json)
- [`src/backend/types/generated/contentTypes.d.ts`](../src/backend/types/generated/contentTypes.d.ts)

### Frontend

- [`src/frontend/app/api/__tests__/portal.spec.ts`](../src/frontend/app/api/__tests__/portal.spec.ts)
- [`src/frontend/app/app.vue`](../src/frontend/app/app.vue)
- [`src/frontend/app/assets/css/main.css`](../src/frontend/app/assets/css/main.css)
- [`src/frontend/app/components/BadgeVerifier.vue`](../src/frontend/app/components/BadgeVerifier.vue)
- [`src/frontend/app/components/CertificateCard.vue`](../src/frontend/app/components/CertificateCard.vue)
- [`src/frontend/app/components/Footer.vue`](../src/frontend/app/components/Footer.vue)
- [`src/frontend/app/components/Header.vue`](../src/frontend/app/components/Header.vue)
- [`src/frontend/app/components/HolderDownloads.vue`](../src/frontend/app/components/HolderDownloads.vue)
- [`src/frontend/app/composables/useBranding.ts`](../src/frontend/app/composables/useBranding.ts)
- [`src/frontend/app/composables/useHolderCredential.ts`](../src/frontend/app/composables/useHolderCredential.ts)
- [`src/frontend/app/composables/useI18n.ts`](../src/frontend/app/composables/useI18n.ts)
- [`src/frontend/app/locales/en.json`](../src/frontend/app/locales/en.json)
- [`src/frontend/app/locales/es.json`](../src/frontend/app/locales/es.json)
- [`src/frontend/app/middleware/auth.ts`](../src/frontend/app/middleware/auth.ts)
- [`src/frontend/app/pages/credentials/[id]/imprimir.vue`](../src/frontend/app/pages/credentials/[id]/imprimir.vue)
- [`src/frontend/app/pages/credentials/[id]/index.vue`](../src/frontend/app/pages/credentials/[id]/index.vue)
- [`src/frontend/app/pages/dashboard.vue`](../src/frontend/app/pages/dashboard.vue)
- [`src/frontend/app/pages/index.vue`](../src/frontend/app/pages/index.vue)
- [`src/frontend/app/pages/linkedin.vue`](../src/frontend/app/pages/linkedin.vue)
- [`src/frontend/app/plugins/i18n.client.ts`](../src/frontend/app/plugins/i18n.client.ts)
- [`src/frontend/app/stores/auth.ts`](../src/frontend/app/stores/auth.ts)
- [`src/frontend/app/utils/download.ts`](../src/frontend/app/utils/download.ts)
- [`src/frontend/app/utils/portal.ts`](../src/frontend/app/utils/portal.ts)
- [`src/frontend/nuxt.config.ts`](../src/frontend/nuxt.config.ts)
- [`src/frontend/package.json`](../src/frontend/package.json)
- [`src/frontend/pnpm-lock.yaml`](../src/frontend/pnpm-lock.yaml)
- [`src/frontend/scripts/qa-portal-config.mjs`](../src/frontend/scripts/qa-portal-config.mjs)
- [`src/frontend/scripts/qa-portal.mjs`](../src/frontend/scripts/qa-portal.mjs)


## Identidad del titular sin correo en emisiones nuevas — 3 de octubre de 2026

Aplicación de la decisión comunicada de ADR 0021 de microcredenciales. Las emisiones nuevas identifican al titular con `credentialSubject.identifier`, una lista de `IdentityObject`. Se omite `credentialSubject.id`: es opcional en este caso, como explica la [guía de implementación OB3](https://www.imsglobal.org/spec/ob/v3p0/impl/). Se siguen las definiciones de `IdentityObject`, `IdentityHash` e `IdentifierTypeEnum` de la [especificación OB3](https://www.imsglobal.org/spec/ob/v3p0/).

El correo se normaliza con `trim().toLowerCase()`. Cada credencial usa 16 bytes aleatorios de `crypto.randomBytes`, representados como 32 caracteres hexadecimales. Se calcula SHA-256 sobre los bytes UTF-8 de **correo normalizado + cadena hexadecimal de la sal**, sin separador, y se antepone `sha256$` al resultado hexadecimal. La sal no se decodifica a bytes antes de concatenarla. Un perfil sin correo no puede emitir una identidad vacía.

Este ejemplo usa `ana@example.test` y una sal ficticia fija únicamente para poder reproducir el resultado:

```json
{
  "identifier": [
    {
      "type": "IdentityObject",
      "identityType": "emailAddress",
      "hashed": true,
      "identityHash": "sha256$cd8e4b3eec1bbc229750b5095d2163d0fb2b18d23dde5c17ab86fb0dac01dd67",
      "salt": "000102030405060708090a0b0c0d0e0f"
    }
  ]
}
```

### Firma, JSON-LD y archivos históricos

La rama firmaba un resumen interno que no cubría `credentialSubject`. Para las emisiones nuevas, `open-badge.ts` llama al firmador EdDSA/JWS existente con el documento OB3 completo, sin `proof`; guarda juntos la firma definitiva y `signedCredential`. El documento firmado incluye el hash y la sal. `verification.ts` utiliza la comprobación ampliada de `signed-content.ts`: compara el documento completo con la copia guardada y también los campos del registro. Alterar el hash o la sal invalida tanto la verificación interna como la del archivo.

Las copias históricas de `signedCredential` se devuelven intactas, incluso si se solicita serialización de emisión. Las históricas sin copia conservan su serialización anterior, incluido `mailto:` y su prueba original. No hay migración ni refirma de registros anteriores. Cambiar el correo del perfil después de emitir no cambia el identificador firmado nuevo.

El contexto oficial OB3 se conserva. Solo en documentos nuevos se añade un contexto explícito para las fechas VC heredadas y el sobre JWS existente. También se serializa `alignment` en singular con `type: Alignment` y la evidencia en la raíz de la credencial, para que todo el documento expanda en modo seguro sin términos descartados. La interfaz sigue leyendo el plural histórico. La prueba JSON-LD incluye fechas, resultados, rúbrica, alineación, evidencia, estado e identidad; usa contextos locales, sin red.

**Alcance de `eddsa-rdfc`:** este checkout no contiene un firmador/verificador de producción `eddsa-rdfc-2022`; conserva su firma JWS. Se comprobó por separado que una copia ficticia del documento nuevo admite firma y verificación RDF con Digital Bazaar, y que modificar hash o sal invalida esa firma. Esta prueba de interoperabilidad no convierte el JWS emitido por Certo en una prueba RDF ni añade soporte de importación de pruebas RDF.

### Comprobación pública por correo

`POST /api/credentials/:id/check-recipient`, sin autenticación, recibe `{ "email": "ana@example.test" }` y devuelve exclusivamente `{ "matches": true }` o `{ "matches": false }`. Acepta los mismos identificadores numéricos, documentId y URN que las otras rutas públicas.

La comparación usa la identidad y la sal del documento guardado, nunca el correo actual del perfil para documentos con copia firmada. Para documentos históricos con `mailto:` normaliza ambos correos; si no existe copia histórica, usa la misma reconstrucción histórica que el serializador. No firma ni escribe datos. La comparación final usa `crypto.timingSafeEqual` sobre digests de longitud fija. Un cuerpo inválido produce 400.

Una credencial inexistente y una con `publicLinkActive: false` devuelven el mismo 404, mensaje y cabecera `Cache-Control: no-store`. Ambas pasan por la misma consulta y una comparación ficticia, con un mínimo aproximado de 75 ms para amortiguar diferencias habituales de lectura; no es una garantía de latencia idéntica bajo carga.

Se reutiliza `global::rate-limit`: por defecto, **50 peticiones por IP cada 15 minutos**, con una cuota compartida entre todos los identificadores de credencial. Se respeta la configuración existente `RATE_LIMIT_*`. Para estas peticiones se usa el resolvedor de IP que confía en el socket y solo acepta cabeceras de proxies configurados explícitamente mediante `PORTAL_TITULAR_IP_SOURCE` y `PORTAL_TITULAR_TRUSTED_PROXY_IPS`. Una cabecera `X-Forwarded-For` arbitraria no permite eludir la cuota. El contador reside en memoria por proceso; para varias instancias hace falta un límite compartido en el proxy o almacén común. No se cambió configuración del laboratorio.

La página pública y `/verify` muestran el formulario opcional en español e inglés. Sus resultados distinguen coincidencia, falta de coincidencia y comprobación no disponible; cambiar el correo o la credencial borra el resultado anterior. El texto explica que conocer el correo no demuestra control de esa cuenta. El correo se envía en el cuerpo POST, nunca en la URL. Al verificar un archivo externo, la consulta usa su ID contra esta instancia; si no está alojado aquí o su enlace está desactivado, la comprobación se indica como no disponible.

`publicVerification` sigue eliminando `credentialSubject.id` e `identifier`. Ahora elimina además ambas copias de `proof` aunque el nombre sea visible: el JWS permite decodificar su payload y expondría el hash y la sal. La descarga autenticada conserva el documento firmado completo. La comparación por correo sigue disponible cuando se oculta el nombre, mientras el enlace permanezca activo.

### Resultados de esta modificación

Node 22.23.3; fixtures ficticias; SQLite temporal; servidores locales en loopback y correo desactivado. Se excluyó `.env` en compilaciones y servidor de QA. No se modificaron secretos, sinope ni el laboratorio.

| Comprobación | Resultado exacto |
| --- | --- |
| Backend, `npm test -- --runInBand` | **33 suites: 32 aprobadas, 1 fallida. 229 pruebas: 227 aprobadas, 2 fallidas.** Incluye 22 pruebas nuevas. |
| Fallos heredados | Los mismos dos casos de `data-portability`: importación de credenciales/evidencias e idempotencia al reimportar. Servicio y prueba idénticos a `HEAD` previo a esta modificación. |
| Frontend, `npm run test:unit` | **13 archivos, 27/27 pruebas aprobadas**; 4 nuevas. Persiste el aviso previo de mock hoisted en `SimpleToast.nuxt.spec.ts`. |
| Backend, `tsc --noEmit` | **Exit 0**, sin diagnósticos. |
| Backend, `npm run build` | **Exit 0**, TypeScript y panel compilados. |
| Frontend, `nuxt build --dotenv /tmp/certo-no-env` | **Exit 0**, cliente y servidor compilados. |
| `scripts/qa/portal-http.cjs` | **38 comprobaciones HTTP aprobadas**: incluye emisión real, coincidencia normalizada, rechazo, alteración de sal, proyección, 404 uniforme y descarga histórica respecto al cambio de privacidad. |
| `scripts/qa/recipient-rdfc.mjs` | **6 comprobaciones aprobadas**, offline: expansión segura del exportado, firma/verificación RDF, alteraciones rechazadas, término indefinido rechazado y ausencia de ID de sujeto. |
| `scripts/qa-recipient.mjs` | **29 comprobaciones aprobadas** en Chromium: ambas páginas, es/en, móvil/escritorio, POST, coincidencia/rechazo, limpieza de resultado y ausencia de desbordamiento. Sin errores JavaScript de página. |
| Revisión visual | Capturas reales de las dos páginas en ambos idiomas; formulario, ayuda y resultados legibles. Artefactos ficticios en `/tmp/certo-recipient-render`. |
| `git diff --check` | **Exit 0**. |

La prueba de hash usa el vector publicado por 1EdTech: `jjefferson18@example.com` + `FleurDeSel` → `sha256$658625b25ab3d75d613ca97d9a5a77f70e2192feca5557f4ad09a4d4f121f5fc`. El contexto OB3 de la fixture se descargó de `https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json` el 3 de octubre de 2026 (SHA-256 `3d34f4d4ef1bce691106e63798beb5e7b862ba841423f5ee1e53ab7ddf3bca84`).

Para repetir el ensayo RDF, instalar en un directorio temporal `@digitalbazaar/eddsa-rdfc-2022-cryptosuite@1.3.0`, `@digitalbazaar/data-integrity@2.5.0`, `@digitalbazaar/ed25519-multikey@1.3.1`, `jsonld-signatures@11.6.0` y `jsonld@9.0.0`. Ejecutar desde backend `node scripts/qa/recipient-rdfc.mjs <credential.json-ficticio> <directorio-temporal>`. El JSON lo deja `portal-http.cjs --browser` junto a su fixture de navegador. No se agregaron dependencias de producción.

Pendientes: corregir los dos fallos heredados de portabilidad en otra tarea; comprobar la atribución de IP/cuota del proxy y la ruta con datos del laboratorio cuando se autorice desplegar. La publicación, el despliegue y una eventual implementación nativa de `eddsa-rdfc-2022` quedan fuera de este cambio. Se prepara únicamente el commit local solicitado.

### Archivos de esta modificación

- [`docs/portal-institucional.md`](../docs/portal-institucional.md)
- [`src/backend/scripts/qa/portal-http.cjs`](../src/backend/scripts/qa/portal-http.cjs)
- [`src/backend/scripts/qa/recipient-rdfc.mjs`](../src/backend/scripts/qa/recipient-rdfc.mjs)
- [`src/backend/src/api/credential/controllers/__tests__/check-recipient.test.ts`](../src/backend/src/api/credential/controllers/__tests__/check-recipient.test.ts)
- [`src/backend/src/api/credential/controllers/__tests__/holder-privacy.test.ts`](../src/backend/src/api/credential/controllers/__tests__/holder-privacy.test.ts)
- [`src/backend/src/api/credential/controllers/credential.ts`](../src/backend/src/api/credential/controllers/credential.ts)
- [`src/backend/src/api/credential/routes/credential-public.ts`](../src/backend/src/api/credential/routes/credential-public.ts)
- [`src/backend/src/api/credential/services/__tests__/recipient-issuance.test.ts`](../src/backend/src/api/credential/services/__tests__/recipient-issuance.test.ts)
- [`src/backend/src/api/credential/services/credential.ts`](../src/backend/src/api/credential/services/credential.ts)
- [`src/backend/src/api/credential/services/holder-access.ts`](../src/backend/src/api/credential/services/holder-access.ts)
- [`src/backend/src/api/credential/services/open-badge.ts`](../src/backend/src/api/credential/services/open-badge.ts)
- [`src/backend/src/middlewares/rate-limit.ts`](../src/backend/src/middlewares/rate-limit.ts)
- [`src/backend/src/utils/__tests__/fixtures/ob3-context.json`](../src/backend/src/utils/__tests__/fixtures/ob3-context.json)
- [`src/backend/src/utils/__tests__/recipient-identity.test.ts`](../src/backend/src/utils/__tests__/recipient-identity.test.ts)
- [`src/backend/src/utils/credential-context.ts`](../src/backend/src/utils/credential-context.ts)
- [`src/backend/src/utils/recipient-identity.ts`](../src/backend/src/utils/recipient-identity.ts)
- [`src/backend/src/utils/signed-content.ts`](../src/backend/src/utils/signed-content.ts)
- [`src/frontend/app/api/api-client.ts`](../src/frontend/app/api/api-client.ts)
- [`src/frontend/app/components/BadgeVerifier.vue`](../src/frontend/app/components/BadgeVerifier.vue)
- [`src/frontend/app/components/RecipientCheck.vue`](../src/frontend/app/components/RecipientCheck.vue)
- [`src/frontend/app/components/__tests__/RecipientCheck.nuxt.spec.ts`](../src/frontend/app/components/__tests__/RecipientCheck.nuxt.spec.ts)
- [`src/frontend/app/locales/en.json`](../src/frontend/app/locales/en.json)
- [`src/frontend/app/locales/es.json`](../src/frontend/app/locales/es.json)
- [`src/frontend/app/pages/credentials/[id]/index.vue`](../src/frontend/app/pages/credentials/[id]/index.vue)
- [`src/frontend/scripts/qa-recipient.mjs`](../src/frontend/scripts/qa-recipient.mjs)
