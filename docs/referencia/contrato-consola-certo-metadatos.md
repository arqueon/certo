# Contrato de metadatos entre la consola y Certo

4-oct-2026 · decisiones 0023 y 0024 · contrato propuesto, pendiente de implementar en Certo.

La consola prepara el nombre de la titular, la procedencia institucional y las condiciones de aprendizaje que deben quedar firmadas. Certo sigue siendo responsable de construir y validar el documento Open Badges 3.0, firmarlo y presentar la verificación y la cartera. Este documento describe el transporte entre aplicaciones; no afirma que un objeto de ejemplo sea por sí mismo una credencial OB3 válida.

## Compatibilidad y fuentes

`CERTO_METADATOS_0023=true`, únicamente en el backend de la consola, habilita los objetos opcionales `data.achievement` y `data.subject`. Está desactivada por defecto: sin ella se conserva el cuerpo anterior. El cliente actual propaga los HTTP 400; no hay garantía de que Certo ignore campos desconocidos. Por eso se utiliza la bandera y se prueba el rechazo con un servidor simulado. Con la bandera activa, un 400 devuelve un mensaje de incompatibilidad y no reintenta la emisión sin metadatos. No se inspeccionó ni modificó el checkout de Certo, ni se hizo una llamada real.

Al activar una versión, `crearAchievement` recibe la preparación exacta que se guarda en `logro-version.instantanea`. En lote y corrección, `emitirCredencial` recibe `fichaDeCohorte`: la relación de versión fijada, o el respaldo histórico ya existente por fecha de apertura. Nunca completa un campo vacío de la instantánea con un valor posterior de la ficha viva. Las versiones antiguas sin estos datos los omiten. El respaldo final de ficha viva para cohortes sin versión recuperable sigue siendo una limitación histórica, visible en pantalla.

La instantánea incorpora instancia (nombre oficial, corto, tipo y sitio), público destinatario, dificultad, idioma, nivel institucional, notas de evaluación y aprobación (nombre de quien activa e instancia que decide). El nombre de aprobación es la identidad del actor autenticado; no se afirma un aval externo. La revisión semántica de resultados medibles sigue siendo responsabilidad académica. Programa, aliada, periodo y fechas proceden de la cohorte; el nombre de la titular, de la persona registrada. Las fechas de actividad son días civiles, representados para este transporte como medianoche UTC: no afirman una hora de asistencia.

## Campos opcionales

| Destino | Fuente y tratamiento |
|---|---|
| `achievement.creator` | Perfil de la instancia del catálogo congelada; `parentOrg` es Universidad de Guadalajara con `https://www.udg.mx/`. No usa el texto libre histórico. |
| `achievement.alignment[]` | Un objeto por resultado de aprendizaje; además, nivel MNC y nivel institucional si están declarados. No se deriva nivel I/II/III de las horas. |
| `achievement.fieldOfStudy` | Clave y nombre CINE-F congelados. |
| `achievement.inLanguage` | Idioma de la ficha; nuevas fichas parten de `es`. |
| `achievement.humanCode`, `version` | Clave original y número de versión como cadena. El identificador técnico del alta sigue siendo `<clave>-v<N>`. |
| `achievement.creditsAvailable` | Créditos SNAATCA cuando la ficha es crediticia. No convierte horas en créditos automáticamente. |
| `achievement.description` | Descripción, horas totales y desglose declarado, modalidad y método de cálculo de créditos. Omite lo desconocido. |
| `achievement.tag[]` | Tipo, crediticia/no crediticia y modalidad, si están declarados. |
| `achievement.criteria` | Regla, enlace de versión, notas y ejes de evaluación, versión de rúbrica y quién activó la ficha. No incluye entregas, rúbricas llenas ni datos de desempeño individuales adicionales. No presume identidad verificada por SSO si la ficha no lo declara. |
| `subject.name` | Nombre completo de la titular. Certo deberá incorporarlo al contexto firmado y al identificador de nombre previsto por 0023. |
| `subject.term` | Periodo de la cohorte. |
| `subject.description`, `tag[]` | Programa o evento de la cohorte. No sustituye el periodo. |
| `subject.source` | Perfil de la institución aliada, con nombre y sitio opcional. |
| `subject.creditsEarned` | Créditos de esa versión cuando es crediticia y se emite a una persona apta. |
| `subject.activityStartDate`, `activityEndDate` | Inicio y fin de la actividad; distintos de apertura/cierre administrativo y de fecha de emisión. |
| `subject.identifiers[]` | Reservado para una futura extensión acordada. Este corte no envía CURP, huella HMAC ni sal. El correo con hash de la 0021 sigue a cargo de Certo. |

El `creator` numérico **de la raíz de `data` en el alta** conserva su función actual de relación al perfil emisor de Certo. No debe confundirse con `data.achievement.creator`, que describe a la instancia creadora. Certo debe mantener un único emisor Universidad de Guadalajara, su DID, logo institucional y dirección Jalisco/MX; la consola no modifica perfiles ni claves del motor.

## Ejemplo completo

Datos ficticios para probar el contrato. Alta `POST /api/achievements`, conservando los campos actuales:

```json
{
  "data": {
    "achievementId": "udg-datos-v2",
    "name": "Análisis de datos",
    "description": "Compara alternativas con datos y justifica una decisión.",
    "creator": 1,
    "achievementType": "MicroCredential",
    "criteria": {"narrative": "Cumple cada criterio.", "url": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"},
    "achievement": {
      "creator": {"type": ["Profile"], "name": "Dirección General de Universidad Virtual y Aprendizaje Digital para Toda la Vida (UDG+)", "url": "https://udgplus.udg.mx", "parentOrg": {"type": ["Profile"], "name": "Universidad de Guadalajara", "url": "https://www.udg.mx/"}},
      "alignment": [
        {"type": ["Alignment"], "targetName": "Compara alternativas con datos y justifica una decisión", "targetCode": "RA1", "targetFramework": "Resultados de aprendizaje"},
        {"type": ["Alignment"], "targetName": "nivel_6", "targetCode": "nivel_6", "targetFramework": "Marco Nacional de Cualificaciones (SEP)"},
        {"type": ["Alignment"], "targetName": "Nivel II", "targetCode": "II", "targetFramework": "Marco institucional CGAI"}
      ],
      "fieldOfStudy": "061 · Tecnologías de la información y la comunicación",
      "inLanguage": "es",
      "humanCode": "UDG-DATOS",
      "version": "2",
      "creditsAvailable": 2,
      "description": "Compara alternativas con datos y justifica una decisión.\nTotal: 32 h; Docencia: 8 h; Trabajo independiente: 12 h; Práctica: 8 h; Evaluación: 4 h\nModalidad: En línea.\nCréditos SNAATCA: 32 h / 16 h por crédito.",
      "tag": ["Microcredencial", "Crediticia", "En línea"],
      "criteria": {"narrative": "Acredita «Análisis de datos» conforme a esta regla: cumplir cada criterio. Juicio humano con rúbrica. Docente; Rúbrica versión 1. Ficha activada por Gestora de prueba; instancia que decide: UDG+.", "url": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"}
    }
  }
}
```

Emisión `POST /api/credentials/issue`. `achievement` lleva exactamente el objeto del alta anterior (se muestra la misma estructura con los campos esenciales para evitar repetir la tabla); los campos opcionales no presentes en la ficha se omiten:

```json
{
  "data": {
    "achievementId": 55,
    "recipient": {"email": "titular@example.org", "name": "Persona de prueba"},
    "evidence": [],
    "awardedDate": "2026-10-31",
    "expirationDate": "2029-11-01T12:00:00.000Z",
    "achievement": {
      "creator": {"type": ["Profile"], "name": "Dirección General de Universidad Virtual y Aprendizaje Digital para Toda la Vida (UDG+)", "url": "https://udgplus.udg.mx", "parentOrg": {"type": ["Profile"], "name": "Universidad de Guadalajara", "url": "https://www.udg.mx/"}},
      "alignment": [
        {"type": ["Alignment"], "targetName": "Compara alternativas con datos y justifica una decisión", "targetCode": "RA1", "targetFramework": "Resultados de aprendizaje"},
        {"type": ["Alignment"], "targetName": "nivel_6", "targetCode": "nivel_6", "targetFramework": "Marco Nacional de Cualificaciones (SEP)"},
        {"type": ["Alignment"], "targetName": "Nivel II", "targetCode": "II", "targetFramework": "Marco institucional CGAI"}
      ],
      "fieldOfStudy": "061 · Tecnologías de la información y la comunicación",
      "inLanguage": "es", "humanCode": "UDG-DATOS", "version": "2", "creditsAvailable": 2,
      "description": "Compara alternativas con datos y justifica una decisión.\nTotal: 32 h; Docencia: 8 h; Trabajo independiente: 12 h; Práctica: 8 h; Evaluación: 4 h\nModalidad: En línea.\nCréditos SNAATCA: 32 h / 16 h por crédito.",
      "tag": ["Microcredencial", "Crediticia", "En línea"],
      "criteria": {"narrative": "Acredita «Análisis de datos» conforme a esta regla: cumplir cada criterio. Juicio humano con rúbrica. Docente; Rúbrica versión 1. Ficha activada por Gestora de prueba; instancia que decide: UDG+.", "url": "https://catalogo.example.org/publico/catalogo/UDG-DATOS?version=2"}
    },
    "subject": {
      "name": "Persona de prueba", "term": "2026-B",
      "description": "Programa o evento: Curso piloto UDG–ASU.", "tag": ["Curso piloto UDG–ASU"],
      "source": {"type": ["Profile"], "name": "Arizona State University", "url": "https://www.asu.edu"},
      "creditsEarned": 2,
      "activityStartDate": "2026-10-01T00:00:00Z", "activityEndDate": "2026-10-31T00:00:00Z"
    }
  }
}
```

`recipient.email` es un dato de entrega entre servicios, como antes: Certo debe continuar convirtiéndolo al IdentityObject con sal de la 0021; no publicarlo como `mailto:`. `resultDescription` y `result` mantienen su contrato existente de resultados por criterio. Certo debe validar el contexto OB3 3.0.3 y resolver los términos de transporte que no admita directamente, sin perderlos silenciosamente.

## CURP: límite deliberado

La consola recibe CURP opcional al registrar una persona o cargar una lista. Recorta espacios exteriores, convierte a mayúsculas y valida 18 posiciones, entidad, fecha real y dígito verificador. Es validación de forma, no consulta a RENAPO ni prueba de identidad. Referencias: [estructura explicada por RENAPO](https://www.gob.mx/segob/renapo/articulos/sabes-como-se-conforma-tu-curp?idiom=es) e [instructivo de asignación](https://www.diariooficial.segob.gob.mx/nota_detalle_popup.php?codigo=5526717).

Guarda solo `HMAC-SHA256(CURP_HMAC_SECRET, "curp:v1:" + CURP_NORMALIZADA)` en `candidato-cohorte.curpHuella`, privada y sin rutas de consulta nuevas. Exige secreto independiente de al menos 32 bytes. La igualdad detecta duplicados dentro de una cohorte; entre cohortes permite un cruce interno sin exponer el identificador. Cambiar el secreto rompe esa igualdad: conservarlo estable y respaldado en la bóveda; una rotación requiere un plan de nueva captura, pues no se conserva la entrada. La huella tampoco sale en expediente, CSV, tableros ni metadatos.

**La CURP queda fuera de la credencial.** Calcular un hash con sal al cargar sería técnicamente posible, pero un solo objeto guardado por candidato se reutilizaría en correcciones o reemisiones y dejaría de ser propio de cada credencial. Tampoco es posible derivar el IdentityObject verificable contra la CURP a partir del HMAC privado. La opción futura es capturarla de nuevo para una operación de emisión identificada, calcular entonces un objeto con sal aleatoria exclusiva, guardar solo ese objeto ligado a esa operación y no reutilizarlo en otra emisión. Requiere acordar el tipo de identidad admitido por Certo/OB3, aviso de privacidad y recuperación de intentos. No se implementa un almacén de CURP en claro ni de valores cifrados reversibles.

## Lo que implementará Certo

Además de aceptar y firmar estos objetos, deberá aplicar el orden de página de 0023: encabezado con titular, insignia, Universidad de Guadalajara › instancia, evento, periodo y estado compacto; qué acredita; cómo se evaluó; verificación con QR y comprobación de identidad; y, solo para la titular, compartir/guardar y privacidad al final. El nombre firmado no desaparece del archivo cuando la titular oculta su nombre en la página pública. Wallet, perfil emisor, firma, privacidad de página y reemisión de credenciales anteriores quedan fuera de este cambio de consola.
