# 0023 · La credencial firmada lleva el nombre de la titular, su origen institucional y los metadatos del marco

**Fecha:** 4-oct-2026 · **Estado:** vigente (por implementar, después de [0022](0022-guardar-en-wallet-credencial-vinculada.md)) · **Precisa:** [0021](0021-identificador-titular-correo-con-hash.md)

## Contexto

Revisión de una credencial emitida con el formato estándar (PR arqueon/certo#19): el documento firmado no lleva el nombre de la titular (solo el correo con hash; el portal muestra el nombre desde su base de datos), el emisor se llama «Consola de gestores UDGPlus» y no hay nada que diga de qué instancia, programa o evento proviene. Rubén pide que la credencial lleve el nombre de quien la posee y los datos institucionales para identificar si viene de un centro universitario, de UDGPlus, de educación para toda la vida o de un evento específico (p. ej. un curso piloto con ASU). Fuente primaria: respuestas de Rubén en el chat del 4-oct-2026.

## Decisión

1. **Nombre de la titular** dentro de lo firmado: identificador de tipo nombre sin hash en el sujeto (y el término de nombre que admita el contexto OB3 3.0.3, para que las carteras lo muestren), junto al correo con hash de la 0021.
2. **Emisor: «Universidad de Guadalajara»** (Profile con sitio y logo institucionales), con un solo DID institucional.
3. **Instancia responsable** como creadora del logro (`achievement.creator`), con la UdeG como organización madre (`parentOrg`). Sale de un **catálogo cerrado** de instancias: el que ya existe para saberes previos, ampliado con centros universitarios, UDGPlus y educación para toda la vida. Sustituye en la emisión al texto libre `unidadAcademicaResponsable`.
4. **Evento o programa específico y, opcional, institución aliada**: campos nuevos **en la cohorte**, porque una misma ficha puede ofrecerse en varios eventos. En la credencial: periodo en `credentialSubject.term`, el evento en la descripción y como etiqueta, y la institución aliada como `credentialSubject.source`.

## Consecuencias

- El nombre viaja en el archivo que la titular comparte; «ocultar mi nombre» sigue aplicando a la página pública de verificación, no al archivo.
- Las fichas existentes necesitan su instancia del catálogo antes de emitir (aviso de coherencia si falta).
- Solo afecta credenciales nuevas; las anteriores se reemiten si se necesitan con estos datos.
- Se implementa antes de abrir «Guardar en mi wallet» a uso real, porque cada copia vinculada firma este contenido.

## Ampliación del 4-oct-2026: metadatos completos y orden de la página

Rubén pidió revisar qué más debe llevar la credencial, contrastando el marco CGAI (certificado digital: identidad del titular, institución emisora, resultado de aprendizaje, criterios de evaluación, fecha de emisión, vigencia y nivel de cualificación; código único; URL y QR), la Recomendación del Consejo de la UE sobre microcredenciales (2022) y el MNC/SNAATCA (Acuerdo 01/02/24, DOF 1-mar-2024; la propuesta de modificación SES de oct-2025, aún por confirmar si se publicó, exige que el certificado de una microcredencial académica indique **nivel del MNC y créditos, de 1 a 15**). La consola ya captura casi todo en la ficha; falta llevarlo a lo firmado:

| Dato | Fuente | Campo Open Badges 3.0 |
|---|---|---|
| Nombre de la titular | CGAI, UE | identificador «nombre» del sujeto (punto 1) |
| Institución emisora, país y región | CGAI, UE | `issuer` UdeG con `address` (Jalisco, MX) |
| Instancia, evento, aliada, periodo | Rubén, CGAI | `achievement.creator`, `term`, `source` (puntos 3-4) |
| Resultados de aprendizaje (lista) | CGAI, UE, MNC | `achievement.alignment`, uno por resultado |
| **Nivel del MNC** (y subnivel) y nivel I/II/III del marco CGAI | CGAI, UE, MNC | `alignment` al nivel del MNC (marco SEP) y al nivel institucional |
| **Créditos SNAATCA** (1-15) y su base (16 h/crédito en superior) | MNC/SNAATCA, UE | `creditsAvailable` en el logro y `creditsEarned` en el sujeto; base y método en la descripción |
| **Horas** totales y desglose (docencia/mediación, independiente, práctica, evaluación) | SNAATCA (MD/EI/PC), UE | texto legible en la descripción del logro |
| Campo de formación (CINE-F) | MNC (alineado a CINE), UE | `fieldOfStudy` |
| Tipo (crediticia o no; microcredencial académica o alternativa) | CGAI, MNC | `achievementType` + etiqueta |
| Modalidad | CGAI, UE | etiqueta y texto |
| Idioma | UE | `inLanguage` |
| Clave y versión de la ficha | CGAI (código y padrón) | `humanCode`, `version` |
| Criterios y tipo de evaluación (rúbrica, evaluador humano, identidad verificada por SSO) | CGAI, UE | `criteria.narrative` + enlace a la ficha versionada |
| Aseguramiento de calidad (quién aprobó la ficha) | UE | texto; más adelante `endorsement` |
| Fechas de la actividad | UE | `activityStartDate`, `activityEndDate` (cohorte) |
| Fecha de emisión, vigencia, código único, verificación | CGAI, UE | `validFrom`, `validUntil`, `id`, página pública (ya está) |

**No va:** evidencia ni rúbricas llenas (el marco excluye los registros automáticos como evidencia; la página pública muestra solo afirmación y estado). Pendiente fuera de la credencial: registro en SIGED de las constancias (MNC, art. 28º) cuando la SEP lo opere para IES autónomas.

**Orden de la página pública de la credencial** (hoy abre con LinkedIn y el panel técnico de comprobaciones):
1. Encabezado: insignia, titular, microcredencial, «Universidad de Guadalajara › instancia», evento y periodo, y un sello compacto «Verificada · vigente hasta…» que despliega las comprobaciones.
2. Qué acredita: descripción, resultados, nivel MNC, créditos y horas, modalidad, enlace a la ficha.
3. Cómo se evaluó: resultados por criterio.
4. Verificar: QR, URL y «¿es de esta persona?».
5. Solo para la titular, al final y separado: «Compartir y guardar» (wallet, PDF, LinkedIn, archivo, CLR) y «Privacidad».
