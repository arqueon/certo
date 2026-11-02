# 0016 · Identidad de la Universidad de Guadalajara en el portal y la verificación

**Estado:** rama local `marca-udg-2026-10` (26-oct-2026), sin push, PR ni despliegue. Sustituye, para el portal del titular, la verificación pública y las páginas de Certo, la identidad UDGPlus (parches 0009 y 0015 del laboratorio) por la de la Universidad de Guadalajara según el manual de identidad UdeG 2025. El sistema se llama «Verificación de credenciales digitales»; «microcredencial» se mantiene como tipo de credencial.

## Qué cambia

- **Paleta** (`app/assets/css/udg-tokens.css`, antes `udgplus-tokens.css`; `udg-componentes.css`, antes `udgplus-componentes.css`). Oficiales: azul 288C `#202945` (principal, texto y botones), rojo 7621C `#B12028` (error y revocada; acento de la medalla), olivo 7495C `#8F993E` y oro 116C `#FDCF85` (decorativos; el oro también es «en espera» en oscuro), gris K85 `#3c3c3b`. El resto son tintes derivados, marcados en el archivo.
- **Tipografía:** Montserrat (complementaria del manual) en títulos, autoalojada con su licencia OFL; Figtree se conserva en texto corrido. Se retira Bricolage Grotesque.
- **Logotipos** en `public/marca/`: `udg-logotipo.svg` (color), `udg-logotipo-blanco.svg`, `udg-escudo.svg` y `udg-escudo-blanco.svg`, optimizados con svgo (98, 48, 41 y 20 KB), sin geometría fuera del viewBox. Favicon, iconos de Android, apple-touch y `site.webmanifest` usan el escudo UdeG.
- **Variables nuevas:** `NUXT_PUBLIC_BRAND_LOGO_INVERSE_URL` (encabezado azul y pie oscuro, sin filtro de silueta) y `NUXT_PUBLIC_BRAND_EMBLEM_URL` (medalla de la portada). Sin ellas, el comportamiento anterior. En el backend: `HIDDEN_RECIPIENT_NAME` (texto del titular oculto), `EMAIL_BRAND_NAME` y `EMAIL_SUPPORT_ADDRESS` (correos al titular).
- **Textos:** título de pestaña y h1 de la portada «Verificación de credenciales digitales» / «Digital credential verification», antetítulo «Universidad de Guadalajara». Los demás textos con UDGPlus pasan a la marca configurable o a una redacción neutra. Por omisión: «Cartera UdeG», «Titular verificado por la Universidad de Guadalajara».
- **Marco de habilidades:** se emite y muestra `Habilidades UdeG` (igual que la consola); `Habilidades UDGPlus` queda en `LEGACY_SKILLS_FRAMEWORKS` para leer las credenciales ya emitidas.
- **Datos de ejemplo** (pruebas, QA y capturas): instancias y aliados neutrales («Instancia de ejemplo», «Comité de reconocimiento», «Institución aliada de ejemplo»), dominios de ejemplo `microcredenciales.udg.mx`.

## Contraste (WCAG 2.x)

| Texto sobre fondo | Cociente |
| --- | --- |
| `#202945` texto / primario sobre `#ffffff` · `#f5f6f9` · `#e9ebf3` | 14.34 · 13.27 · 12.05 |
| `#ffffff` sobre `#202945` · `#34406a` · `#4a5a8c` (degradado) | 14.34 · 10.06 · 6.70 |
| `#565c70` suave sobre `#ffffff` · `#f5f6f9` · `#e9ebf3` | 6.64 · 6.15 · 5.58 |
| `#3a4a80` enlace / foco sobre `#ffffff` · `#f5f6f9` · `#e9ebf3` | 8.50 · 7.86 · 7.14 |
| `#5c6328` vigente sobre `#eef0dc` · `#ffffff` | 5.54 · 6.42 |
| `#8a5800` en espera sobre `#fef3df` | 5.49 |
| `#B12028` revocada sobre `#f9e5e6` · `#ffffff`; blanco sobre `#B12028` | 5.59 · 6.76 · 6.76 |
| Oscuro: `#e8eaf2` sobre `#0f1322` · `#181e33` · `#1f2740` | 15.38 · 13.74 · 12.29 |
| Oscuro: `#a6adc2` suave · `#aab4dc` enlace sobre `#181e33` | 7.37 · 8.07 |
| Oscuro: `#202945` sobre `#e3e7f3` (botón primario) | 11.60 |
| Oscuro: `#c7cf86` · `#FDCF85` · `#f0a3a8` sobre `#181e33` | 9.98 · 11.35 · 8.26 |
| Página de cartera: `#aab4dc` sobre `#12161f`; `#202945` sobre `#aab4dc` | 8.85 · 7.01 |

Olivo 7495C sobre blanco da 3.09 y oro 116C sobre fondos claros no llega a 2: los dos se usan solo como decoración (anillo de la medalla) o, el oro, sobre azul.

## Configuración de despliegue recomendada

`NUXT_PUBLIC_BRAND_NAME=UdeG` (forma corta del manual: los textos interpolan la marca en frases como «Qué se acredita en UdeG» o «Entrar con mi cuenta UdeG», que no se leen bien con el nombre completo sin artículo), `NUXT_PUBLIC_BRAND_PRIMARY_COLOR=#202945`, `NUXT_PUBLIC_WALLET_APP_NAME=Cartera UdeG` y los tres logotipos (pueden servirse desde `/marca/` de este mismo frontend).

## Pendientes

- Se retiró `public/udgplus-logo.svg`: el despliegue debe apuntar a `/marca/udg-*.svg` en el mismo cambio. `public/marca/udg-lockup.svg` (sin UDG+, sin uso en el código) se conserva.
- Los correos al titular siguen en inglés (plantillas del proyecto original); solo el nombre del sistema y el contacto son configurables.
