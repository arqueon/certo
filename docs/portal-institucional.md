# Portal institucional y privacidad del titular

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

La descarga contiene los datos originales aunque se oculte el nombre público. El texto de privacidad lo explica. «Guardar en mi wallet» es una explicación de importación en una cartera compatible con Open Badges 3.0, sin integración nueva.

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

