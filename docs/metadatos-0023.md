# Metadatos de titular y origen en Certo — decisión 0023

Implementación local del 4 de octubre de 2026 en `feat/metadatos-0023`. Sigue la [decisión 0023](referencia/0023-datos-de-titular-y-origen-en-la-credencial.md) y el [contrato de la consola](referencia/contrato-consola-certo-metadatos.md). No modifica el DID, la propiedad de perfiles ni los archivos ya firmados. No requiere una bandera nueva en Certo: `CERTO_METADATOS_0023=true` corresponde exclusivamente al backend de la consola.

## Antes y después

Antes, la credencial nueva solo identificaba a la titular mediante el correo con hash; su nombre visible procedía del perfil mutable. Ahora el nombre y los metadatos se guardan como instantáneas y se firman. El emisor se presenta como Universidad de Guadalajara y la instancia creadora pertenece al logro, sin cambiar la relación propietaria que autoriza la emisión.

Antes, la página empezaba por compartir en LinkedIn y las comprobaciones técnicas. Ahora muestra identidad, logro y procedencia; qué acredita; cómo se evaluó; y cómo verificar. Las descargas, wallet, LinkedIn y privacidad aparecen al final, solo para la titular. La impresión A4 reutiliza los datos del documento firmado. Las credenciales antiguas muestran sus datos disponibles; no se completan con el catálogo actual ni se vuelven a firmar.

## Términos y decisiones de mapeo

Se contrastaron el [contexto OB3 3.0.3](https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json), el [contexto VC 2.0](https://www.w3.org/ns/credentials/v2), la [especificación OB3](https://www.imsglobal.org/spec/ob/v3p0/) y el [esquema OB3 VC 2.0](https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json). Se usan los contextos oficiales locales existentes y su cargador cerrado; no se añade un contexto propio ni acceso HTTP para resolver términos. Las pruebas expanden el documento con `jsonld.expand(..., {safe: true})` y verifican la firma Data Integrity real.

**Nombre:** `name` está definido globalmente por OB3 como `schema:name`, por lo que está disponible en `AchievementSubject`. El esquema de ese objeto admite propiedades adicionales. Además se incluye un `IdentityObject` de tipo `name`: este valor pertenece al vocabulario `IdentifierTypeEnum` que usa `identityType`. Con `hashed: false`, `identityHash` contiene el nombre en claro, sin sal. No se inventa `fullName` ni `ext:name`. Se conserva por separado el correo con SHA-256 y sal aleatoria por credencial.

**Niveles:** OB3 no ofrece un valor simple `Level` ni `QualificationLevel` en `AlignmentTargetType`. Se utiliza su extensión permitida `ext:QualificationLevel` tanto para MNC como para CGAI. El marco y código distinguen ambos. Los resultados de aprendizaje usan `ceasn:Competency`. Esto no afirma que SEP publique un servicio CASE, ni que el nivel sea una rúbrica. La página convierte `nivel_6` en «Nivel 6» exclusivamente para mostrarlo; el código original queda firmado. No calcula nivel ni créditos a partir de horas.

**URL de alineación:** el esquema exige `targetUrl`, pero el ejemplo de transporte no la incluye. Se conserva la enviada; en su ausencia se usa `achievement.criteria.id/url` de la versión y, como último recurso, la URL del logro de Certo. La URL identifica el documento que declara la alineación; no se inventa una URL oficial SEP ni un fragmento inexistente. Conviene que la ficha declare de forma visible todos sus resultados y niveles.

| Campo recibido | Campo firmado y tratamiento |
| --- | --- |
| `data.creator` en alta | Relación interna al perfil propietario. No se confunde con la instancia ni se renombra en base. |
| `achievement.creator` | `credentialSubject.achievement.creator`, `Profile` con `id`, `type`, `name`, sitio e imagen si llegan. |
| `creator.parentOrg` | `Profile` anidado; el contrato aporta Universidad de Guadalajara. |
| `Profile.id` ausente | Usa su URL HTTPS. Sin URL, URN determinista `urn:certo:profile:<sha256 del nombre>`; identificador local, no registro oficial. |
| `Profile.image` | Cadena HTTPS u objeto `{id,type}` → `Image` con `id` HTTPS y `type: Image`. |
| `achievement.alignment[]` | `alignment[]` con `type: [Alignment]`, nombre, código, marco, descripción, tipo y URL según lo explicado arriba. |
| `fieldOfStudy`, `inLanguage` | Mismo nombre en el logro; campo CINE-F e idioma declarados. |
| `humanCode`, `version` | Mismo nombre en el logro, ambas cadenas. El ID técnico del alta queda separado. |
| `creditsAvailable` | Número en el logro; sin conversión automática. |
| `achievement.description`, `tag[]` | Descripción y etiquetas del logro. Horas, desglose, modalidad y método de créditos se conservan en el texto que envía la consola. |
| `achievement.criteria.narrative` | Texto firmado, si se envía. Sin criterio se firma `criteria: {}` (propiedad obligatoria del logro) sin relleno. |
| `achievement.criteria.id/url` | `criteria.id`. Si llegan ambos, deben coincidir. También se acepta el alias en `data.criteria` del alta. |
| `subject.name` | `credentialSubject.name` y `identifier[]` de nombre sin hash. Sin `subject.name`, usa `recipient.name` recibido y después el del perfil existente. La instantánea evita cambios posteriores del perfil. |
| `recipient.email` | Continúa el `IdentityObject` de correo con hash y sal de 0021; no se firma `mailto:`. |
| `subject.term` | `credentialSubject.term`; no se sustituye por programa o evento. |
| `subject.description` | `credentialSubject.description`, término global definido por OB3. |
| `subject.tag[]` | Se convierte en `credentialSubject.narrative`, «Programa o evento: …», conservando las etiquetas separadas por punto y coma. `tag` solo está definido en el contexto local de Achievement, no en el sujeto. |
| `subject.source` | `credentialSubject.source`, `Profile` de la institución aliada con el mismo tratamiento de identidad y sitio. |
| `subject.creditsEarned` | Número en el sujeto; distinto de los créditos ofrecidos por el logro. |
| `activityStartDate`, `activityEndDate` | ISO 8601 UTC en el sujeto. Se conserva el transporte datetime que exige el esquema OB3; el contexto 3.0.3 los tipa como `xsd:date`. Esa diferencia pertenece a los artefactos oficiales y no se parchea. En pantalla se leen en UTC para no desplazar el día civil. |
| `subject.identifiers[]` | Reservado por el contrato vigente: acepta ausencia o `[]`; una lista no vacía devuelve 400 explicando la reserva. No se acepta CURP, HMAC ni una identidad inyectada por la consola. |
| `resultDescription`, `result`, `awardedDate` | Contrato anterior conservado. El nivel se resuelve por `result.achievedLevel` dentro de `rubricCriterionLevel` del criterio firmado; la pantalla muestra su `name`, no la URI ni solo su posición. |

## Validación y compatibilidad del transporte

Los objetos opcionales se validan antes de crear la credencial. Un campo conocido con tipo incorrecto, URL insegura o longitud excesiva produce HTTP 400 con `Metadatos: <ruta> <motivo>`. `null` no equivale a omisión. No se convierten números ni booleanos a texto.

El contrato no exige rechazar claves desconocidas: **se ignoran dentro de `achievement`, `subject` y sus objetos**, mediante selección explícita de campos; nunca se copian al documento. Esto incluye `@context`, `proof` y tipos adicionales. Los campos raíz anteriores del CRUD conservan la validación de Strapi. El campo privado de almacenamiento `metadata0023` no se admite como atajo: el controlador lo retira del cuerpo.

Límites: nombres de persona/perfil 500 caracteres; descripción del logro y narrativa de criterios 20 000; descripción del sujeto 4 000; campo de estudio 1 000; periodo 200; clave/código 128; versión e idioma 64; URL/URN 2 048; etiquetas 50 de hasta 200; alineaciones 100 (nombre 2 000, descripción 4 000, marco 500, tipo 100). Perfil con máximo un `parentOrg`. Textos conocidos no vacíos; arrays vacíos admitidos. Las URLs de metadatos son HTTPS sin usuario ni contraseña; los ID de perfil admiten HTTPS o URN. Tipos, si llegan, deben coincidir exactamente con el tipo OB3 esperado.

Fechas: UTC con segundos, fracción opcional y `Z`, fecha civil real e inicio no posterior al fin. Créditos: número finito entre 0 y 10 000; es un límite técnico general del motor, **no una validación académica de SNAATCA**. Certo no impone 1–15 a todos los tipos de logro ni afirma una obligación normativa pendiente de confirmar. La consola decide los créditos de la versión.

En emisión, omitir `achievement` reutiliza la instantánea guardada al dar de alta el logro. Enviar un objeto, incluido `{}`, lo sustituye entero: sus campos vacíos no se rellenan desde metadatos posteriores del logro. Los campos básicos anteriores (`name`, `description`, imagen, criterios de raíz, tipo) conservan su ruta existente. Las instantáneas de rúbrica siguen en la credencial.

## Persistencia, propiedad y privacidad

Tres campos JSON opcionales y privados, sin valores por defecto: `achievement.metadata0023`, `credential.achievementMetadata0023` y `credential.subjectMetadata0023`. Los tipos generados se actualizan. Strapi incorpora las columnas de forma aditiva; no hay migración masiva, cambio de llaves ni modificación de documentos históricos.

La autorización sigue dependiendo del propietario de `data.creator` y del perfil emisor. La instancia creadora es un dato firmado, no una relación que conceda permisos. El documento completo sigue guardado en `signedCredential`; exportación y wallet utilizan ese original. La comprobación de contenido guardado también compara las instantáneas 0023 con sus claims firmados.

La proyección pública retira instantáneas privadas, proof e identificadores. Si se oculta el nombre, retira también `credentialSubject.name` y conserva solo los campos de aprendizaje previstos; no expone otros identificadores de importaciones antiguas. Mantiene periodo, aliada y datos de actividad. El archivo descargado y la copia vinculada a wallet conservan el nombre firmado: la privacidad de página no modifica su firma ni las copias ya compartidas.

No se modifica `HolderWallet`: ya crea su copia desde el documento completo y conserva las afirmaciones originales. `HolderDownloads` se mueve al final y admite las acciones de compartir mediante un slot. Las evidencias individuales no se presentan en la página rediseñada. La proyección pública no es una credencial firmada exportable.

## Variables nuevas del backend

| Variable | Valor por defecto y validación |
| --- | --- |
| `ISSUER_PROFILE_NAME` | `Universidad de Guadalajara`; texto no vacío, máximo 500 caracteres. |
| `ISSUER_PROFILE_URL` | `https://www.udg.mx`; HTTPS sin credenciales. |
| `ISSUER_PROFILE_IMAGE` | `${PUBLIC_URL}/marca/escudo-udeg.png`; utiliza el recurso ya presente en `src/frontend/public/marca/`. Un valor explícito debe ser HTTPS. |
| `ISSUER_PROFILE_ADDRESS` | `Jalisco, MX`; formato `Región, CC`, con código de país de dos letras mayúsculas; genera `Address.addressRegion` y `addressCountryCode`. |

Se aplican al serializar una credencial **nueva**, sin tocar el nombre de la fila del perfil ni su dueño. No cambian las variables `ISSUER_DID_WEB_*` ni el DID. La base de la imagen procede de `PUBLIC_URL` (o de `server.url` en QA). El arnés permite HTTP únicamente en su origen loopback; no relaja la validación HTTPS del transporte ni de variables explícitas.

Los textos predeterminados auditados: nuevas emisiones ya no inyectan «Criteria not specified»; evidencia sin nombre usa «Evidencia». El serializador conserva el texto anterior únicamente al reconstruir documentos históricos con proof, para no cambiar su contenido. «System Issuer» sigue siendo una búsqueda interna de perfiles; el Profile firmado nuevo se sustituye por la configuración institucional. «Unknown Recipient» del importador y «Unnamed credential» de la proyección de validación no se añaden al documento importado inmutable.

## Pruebas y evidencia local

Comandos ejecutados con dotenv inexistente, SQLite temporal, correo desactivado y claves ficticias. Node 22; Strapi y Nuxt solo en loopback. No se tocó sinope, configuración remota, `.env` ni secretos. No se hizo push ni despliegue.

| Comprobación | Resultado |
| --- | --- |
| Jest completo, backend | **38 suites: 37 aprobadas, 1 fallida; 319 pruebas: 317 aprobadas, 2 fallidas**. |
| Nuevas pruebas de metadatos | **43 aprobadas**: validación, límites, tipos, URLs, mapeo, firma, alteración, privacidad e inmutabilidad. Incluidas en el total anterior. |
| Baseline de HEAD en copia temporal, `data-portability` | **2 aprobadas y 2 fallidas**: reproduce exactamente los fallos de importación y deduplicación. No se cambió ese servicio ni su prueba. |
| HTTP con Strapi temporal | **33 aserciones aprobadas**. Alta y emisión usan los JSON exactos del contrato, cambiando únicamente los ID relacionales de la base temporal. Además prueba la rúbrica existente, ausencia/reemplazo de metadatos, autorización y privacidad. |
| Documento de HTTP → verifier-core 1.0.0-beta.11 | Firma, estado, vigencia y esquema OB3 **válidos**, sin errores fatales. Resolver y validadores reales; transporte sustituido por los documentos locales. `registered_issuer: false` es esperado para el emisor ficticio. |
| Regresión HTTP de portal y wallet | **55 aserciones de portal + 83 de wallet aprobadas**, incluida copia vinculada y revocación conjunta. Se pasaron los orígenes de QA como entorno del comando; no se modificó el script previo. |
| JSON-LD | Expansión segura del documento completo aprobada, sin términos indefinidos; cargador de contextos cerrado y sin red. |
| Backend `tsc --noEmit` | Exit 0. |
| Builds Strapi y Nuxt | Ambos exit 0. |
| Frontend Vitest | **15 archivos, 38 pruebas aprobadas**. |
| Frontend typecheck | **33 diagnósticos anteriores**; baseline con la configuración inicial del checkout: **35**. Se eliminaron dos del cálculo de fechas de LinkedIn; no hay diagnósticos nuevos. HEAD limpio presenta 34, pues el cambio previo de `nuxt.config.ts` produce un diagnóstico adicional en la prueba de HolderWallet. |
| Chromium | **26 aserciones aprobadas**, sin errores JavaScript: escritorio, móvil, orden, nivel alcanzado, sello desplegable, controles exclusivos de titular, privacidad e impresión. |
| Impresión Chromium + Poppler | **Una página A4**, 594.96 × 841.92 puntos, revisada visualmente. Textos, rúbrica y QR sin recortes. |
| `git diff --check` | Sin errores. |

En el sandbox, el subproceso DCC de ocho pruebas devolvía stdout vacío. La ejecución autorizada en la sesión host eliminó esos ocho fallos; el resultado de backend indicado arriba corresponde a esa ejecución. Subsisten los avisos previos de Ajv sobre el esquema oficial y el mock hoisted de `SimpleToast`.

Artefactos revisados en `/tmp/certo-0023-render/`: `public-desktop.png`, `checks-desktop.png`, `public-mobile.png`, `holder-desktop.png`, `hidden-mobile.png`, `print.png`, `credential-a4.pdf` y `a4-page.png`. La insignia del ensayo es el placeholder local de Certo; todos los datos de personas y logros son ficticios. Los logs están en `/tmp/certo-0023-{backend-host,http,browser,vitest,frontend-types,backend-build,frontend-build}.log`.

### Reproducir

Desde `src/backend`, tras instalar las dependencias del lockfile:

```sh
ENV_PATH=/tmp/certo-no-env npm test -- --runInBand
node node_modules/typescript/bin/tsc --noEmit
ENV_PATH=/tmp/certo-no-env XDG_CONFIG_HOME=/tmp/certo-0023-config STRAPI_TELEMETRY_DISABLED=true npm run build
node scripts/qa/metadata-http.cjs --browser
```

El último comando imprime la ruta a `browser-fixture.json`. No imprime sus tokens. Sin `--browser` cierra Strapi al terminar. Desde `src/frontend`:

```sh
ENV_PATH=/tmp/certo-no-env node node_modules/vitest/vitest.mjs run
node node_modules/nuxt/bin/nuxt.mjs typecheck --dotenv /tmp/certo-no-env
node node_modules/nuxt/bin/nuxt.mjs build --dotenv /tmp/certo-no-env
```

Arrancar el servidor construido con `NITRO_HOST=127.0.0.1`, `NITRO_PORT=19300`, `NUXT_PUBLIC_BRAND_NAME=UDGPlus`, `NUXT_PUBLIC_API_URL=http://127.0.0.1:19337` y `NUXT_PUBLIC_WEBSITE_URL=http://127.0.0.1:19300`. En otra terminal:

```sh
QA_CHROMIUM=/usr/bin/chromium node scripts/qa-metadata.mjs /ruta/impresa/browser-fixture.json
```

## Ejemplo completo firmado

**Ficción de QA:** no acredita a una persona real, no es una emisión universitaria y sus dominios `example.org` no sirven los recursos. Se generó una clave efímera exclusiva del ensayo. El archivo tiene una firma real, no abreviada; se incluyen solo el documento DID público y la lista de estado para verificarlo sin red. La clave privada no se conserva en estos ejemplos.

- [Credencial ficticia completa](ejemplos/metadatos-0023/credencial-ficticia.json).
- [DID público ficticio](ejemplos/metadatos-0023/did-ficticio.json).
- [Lista de estado ficticia firmada](ejemplos/metadatos-0023/estado-ficticio.json).

El arnés también verifica la firma y el esquema de este ejemplo. Se puede repetir usando `scripts/qa/dcc-local.mjs --core`, con `{credential, didDocument, statusList}` por stdin. La vigencia se evalúa contra la fecha real de ejecución; el estado adjunto es una instantánea de QA, no una consulta institucional vigente.

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "urn:uuid:217c2c71-4b07-47d4-a5bf-c525d874ba66",
  "type": [
    "VerifiableCredential",
    "OpenBadgeCredential"
  ],
  "issuer": {
    "id": "did:web:credenciales.example.org",
    "type": [
      "Profile"
    ],
    "name": "Universidad de Guadalajara",
    "url": "https://www.udg.mx",
    "image": {
      "id": "https://credenciales.example.org/marca/escudo-udeg.png",
      "type": "Image"
    },
    "address": {
      "type": [
        "Address"
      ],
      "addressRegion": "Jalisco",
      "addressCountryCode": "MX"
    }
  },
  "validFrom": "2026-10-05T01:44:54.540Z",
  "name": "Análisis de datos",
  "description": "Compara alternativas con datos y justifica una decisión.",
  "credentialSubject": {
    "identifier": [
      {
        "type": "IdentityObject",
        "identityType": "emailAddress",
        "hashed": true,
        "identityHash": "sha256$471f6344b21175f78d78bf4b6c49ebd6f435739fb8b599a4e9edd2cc497f9586",
        "salt": "df173ba6c09d6a5bc56ad414e7799841"
      },
      {
        "type": "IdentityObject",
        "identityType": "name",
        "hashed": false,
        "identityHash": "Persona de prueba"
      }
    ],
    "type": [
      "AchievementSubject"
    ],
    "awardedDate": "2026-10-31T00:00:00.000Z",
    "achievement": {
      "id": "https://credenciales.example.org/api/achievements/1",
      "type": [
        "Achievement"
      ],
      "achievementType": "MicroCredential",
      "name": "Análisis de datos",
      "description": "Compara alternativas con datos y justifica una decisión.\nTotal: 32 h; Docencia: 8 h; Trabajo independiente: 12 h; Práctica: 8 h; Evaluación: 4 h\nModalidad: En línea.\nCréditos SNAATCA: 32 h / 16 h por crédito.",
      "image": {
        "id": "http://127.0.0.1:19300/placeholder-badge.png",
        "type": "Image"
      },
      "criteria": {
        "narrative": "Acredita «Análisis de datos» conforme a esta regla: cumplir cada criterio. Juicio humano con rúbrica. Docente; Rúbrica versión 1. Ficha activada por Gestora de prueba; instancia que decide: UDG+.",
        "id": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"
      },
      "fieldOfStudy": "061 · Tecnologías de la información y la comunicación",
      "inLanguage": "es",
      "humanCode": "UDG-DATOS",
      "version": "2",
      "creator": {
        "type": [
          "Profile"
        ],
        "name": "Dirección General de Universidad Virtual y Aprendizaje Digital para Toda la Vida (UDG+)",
        "url": "https://udgplus.udg.mx",
        "id": "https://udgplus.udg.mx",
        "parentOrg": {
          "type": [
            "Profile"
          ],
          "name": "Universidad de Guadalajara",
          "url": "https://www.udg.mx/",
          "id": "https://www.udg.mx/"
        }
      },
      "creditsAvailable": 2,
      "tag": [
        "Microcredencial",
        "Crediticia",
        "En línea"
      ],
      "alignment": [
        {
          "type": [
            "Alignment"
          ],
          "targetName": "Compara alternativas con datos y justifica una decisión",
          "targetCode": "RA1",
          "targetFramework": "Resultados de aprendizaje",
          "targetType": "ceasn:Competency",
          "targetUrl": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"
        },
        {
          "type": [
            "Alignment"
          ],
          "targetName": "nivel_6",
          "targetCode": "nivel_6",
          "targetFramework": "Marco Nacional de Cualificaciones (SEP)",
          "targetType": "ext:QualificationLevel",
          "targetUrl": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"
        },
        {
          "type": [
            "Alignment"
          ],
          "targetName": "Nivel II",
          "targetCode": "II",
          "targetFramework": "Marco institucional CGAI",
          "targetType": "ext:QualificationLevel",
          "targetUrl": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"
        }
      ]
    },
    "name": "Persona de prueba",
    "term": "2026-B",
    "description": "Programa o evento: Curso piloto UDG–ASU.",
    "source": {
      "type": [
        "Profile"
      ],
      "name": "Arizona State University",
      "id": "https://www.asu.edu",
      "url": "https://www.asu.edu"
    },
    "creditsEarned": 2,
    "activityStartDate": "2026-10-01T00:00:00Z",
    "activityEndDate": "2026-10-31T00:00:00Z",
    "narrative": "Programa o evento: Curso piloto UDG–ASU"
  },
  "credentialStatus": {
    "id": "https://credenciales.example.org/api/revocation-lists/1#0",
    "type": "BitstringStatusListEntry",
    "statusPurpose": "revocation",
    "statusListIndex": "0",
    "statusListCredential": "https://credenciales.example.org/api/revocation-lists/1"
  },
  "validUntil": "2029-11-01T12:00:00.000Z",
  "proof": {
    "type": "DataIntegrityProof",
    "created": "2026-10-05T01:44:55Z",
    "verificationMethod": "did:web:credenciales.example.org#key-1",
    "cryptosuite": "eddsa-rdfc-2022",
    "proofPurpose": "assertionMethod",
    "proofValue": "z2t9YdPZkmvQ698jZ8JBhEtbG2qYQiF5tzftyoV6wFWCPo4vNKg9QmHhCN957tyyTp2YtHMJpqMGhAzqfgEBmSjsV"
  }
}
```

## Archivos y pendientes

Backend: `src/utils/ob3-metadata.ts`, `src/utils/signed-content.ts`, los esquemas de achievement/credential y sus tipos generados, el controlador de achievement, el controlador de emisión y los servicios credential/open-badge/holder-access. `verification.ts` reutiliza la comprobación extendida de `signed-content`; su mecanismo criptográfico no cambia. Pruebas: `ob3-metadata.test.ts`, `metadata-contract.json`, `scripts/qa/metadata-http.cjs`.

Frontend: `CredentialLearning.vue`, `HolderDownloads.vue`, `credential-metadata.ts`, `credentials/[id]/index.vue`, `imprimir.vue`, `credential-metadata.spec.ts` y `scripts/qa-metadata.mjs`. Documentación: este archivo y los tres JSON ficticios.

Pendientes: los dos fallos heredados de data-portability y los 33 diagnósticos de tipos del frontend; revisión académica del contenido y de los niveles declarados; ensayo integrado con consola y wallet reales cuando se autorice el despliegue. No se afirma haber probado un dispositivo LCW real. La extensión no vacía de `subject.identifiers` requiere otro acuerdo de contrato. La política de versiones y de aprobación de fichas sigue siendo responsabilidad de la consola.

Los cambios previos en `scripts/qa/portal-http.cjs`, `nuxt.config.ts` y sus copias en conflicto se conservaron y no forman parte de estos commits.
