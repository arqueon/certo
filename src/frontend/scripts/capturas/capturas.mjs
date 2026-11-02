// Capturas del portal con marca (dirección B) contra datos ficticios.
// 1. scripts/capturas/servidor.sh            (nuxt dev en 127.0.0.1:3311)
// 2. node scripts/capturas/capturas.mjs DIR [filtro...]
// Cada escenario abre una página con sesión simulada (localStorage) y responde
// las llamadas a la API ficticia (127.0.0.1:3399). Informa los errores de página.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.argv[2] || 'capturas'
const ONLY = process.argv.slice(3)
mkdirSync(OUT, { recursive: true })
const BASE = process.env.CAPTURAS_BASE || 'http://127.0.0.1:3311'
const API = 'http://127.0.0.1:3399'
const DAY = 86_400_000
const iso = d => new Date(Date.now() + d * DAY).toISOString()
const fecha = d => iso(d).slice(0, 10)

const user = { id: 8, username: 'ana.lopez', email: 'ana.lopez@microcredenciales.invalid', provider: 'keycloak', confirmed: true, createdAt: iso(-40) }
const profile = { id: 7, name: 'Ana López Ruiz', email: user.email, profileType: 'Recipient' }
const wallets = [
  { id: 1, kind: 'account', client: 'web', name: 'Cartera UdeG', addedAt: iso(-20), credentials: 3, lastSavedAt: iso(-2) },
  { id: 2, kind: 'device', client: 'app', name: null, addedAt: iso(-6), credentials: 1, lastSavedAt: null },
]
const ficha = {
  clave: 'DEMO-EVAL',
  nombre: 'Evaluación auténtica en entornos virtuales',
  proposito: 'Diseñar evaluaciones que pidan a las y los estudiantes resolver problemas reales y mostrar su desempeño.',
  resultadosAprendizaje: [{ enunciado: 'Diseña una tarea auténtica alineada con un resultado de aprendizaje.' }, { enunciado: 'Construye una rúbrica analítica con criterios observables.' }],
  perfilIngreso: 'Docentes de educación media superior y superior.',
  evidencias: [{ nombre: 'Portafolio de evaluación', descripcion: 'Una tarea auténtica con su rúbrica y un ejemplo de retroalimentación.', rubrica: {
    criterios: [
      { codigo: 'C1', nombre: 'Autenticidad de la tarea', descripcion: 'La tarea reproduce un problema del ámbito profesional.', ponderacion: 50, nivelesDesempeno: [{ nivel: 1, nombre: 'En desarrollo', descriptor: 'Problema escolar sin contexto.', puntos: 1 }, { nivel: 2, nombre: 'Logrado', descriptor: 'Problema real con producto verificable.', puntos: 2 }] },
      { codigo: 'C2', nombre: 'Rúbrica', descripcion: 'Criterios observables y niveles distinguibles.', ponderacion: 50, nivelesDesempeno: [] },
    ],
    regla: { criteriosEliminatorios: ['C1'], nivelMinimoPorCriterio: 2 },
  } }],
}
const solicitudes = [
  { referencia: 'SP-0003', estado: 'en_revision', createdAt: iso(-4), fechaLimite: fecha(10), descripcionSaberes: 'Diseñé el sistema de evaluación por proyectos de mi academia y lo apliqué dos semestres.', evidencias: 'https://ejemplo.invalid/portafolio', logro: { clave: 'DEMO-EVAL', nombre: 'Evaluación auténtica en entornos virtuales' }, instanciaDestinataria: 'Instancia de ejemplo', correoVerificado: true },
  { referencia: 'SP-0002', estado: 'no_procede', subsanable: true, createdAt: iso(-30), fechaLimite: fecha(-16), resueltaEn: iso(-18), descripcionSaberes: 'Doy tutoría en línea desde 2019.', logro: { clave: 'DEMO-TUT', nombre: 'Tutoría en línea: acompañamiento y retroalimentación' }, instanciaDestinataria: 'Instancia de ejemplo', instanciaDecide: 'Comité de reconocimiento', justificacion: 'La descripción no muestra cómo retroalimentas a tus estudiantes. Falta un ejemplo concreto.', indicacionesSubsanacion: 'Agrega dos ejemplos de retroalimentación que hayas dado, sin datos de estudiantes.', correoVerificado: true },
  { referencia: 'SP-0001', estado: 'reconocida', estadoCredencial: 'emitida', createdAt: iso(-60), fechaLimite: fecha(-46), resueltaEn: iso(-50), descripcionSaberes: 'Coordino el diplomado de diseño instruccional.', logro: { clave: 'DEMO-DI', nombre: 'Diseño instruccional con IA generativa' }, instanciaDestinataria: 'Instancia de ejemplo', instanciaDecide: 'Comité de reconocimiento', justificacion: 'Tus productos cumplen todos los criterios de la ficha.', criteriosEquivalencia: 'Rúbrica de la ficha DEMO-DI, nivel Logrado en los tres criterios.', correoVerificado: true },
]

function responder(state) {
  return async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const headers = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type, authorization, idempotency-key', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers })
    }
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (p === '/api/profiles/me') {
      return json({ data: profile })
    }
    if (p === '/api/users/me') {
      return json(user)
    }
    if (p === '/api/holder/wallets') {
      return state.walletsError ? json({ error: {} }, 500) : json({ data: state.wallets ?? wallets })
    }
    if (p === '/api/profiles/me/export') {
      return json({ profile })
    }
    const titular = p.replace('/api/portal-titular/', '')
    if (p.startsWith('/api/portal-titular/')) {
      if (state.titularError) {
        return json({ error: {} }, 500)
      }
      if (titular === 'sesion') {
        return state.sinSesion ? json({ error: {} }, 401) : json({ data: { nombre: profile.name, correo: user.email, correoVerificado: !state.sinVerificar } })
      }
      if (titular === 'catalogo-publico') {
        return json({ data: [{ clave: 'DEMO-EVAL', nombre: ficha.nombre }, { clave: 'DEMO-TUT', nombre: 'Tutoría en línea' }] })
      }
      if (titular.startsWith('catalogo-publico/')) {
        return json({ data: ficha })
      }
      if (titular === 'instancias') {
        return json({ data: [{ clave: 'EJEMPLO', nombre: 'Instancia de ejemplo' }] })
      }
      if (titular.startsWith('solicitudes-saberes')) {
        return json({ data: state.sinSolicitudes ? [] : solicitudes })
      }
    }
    return json({ data: [] })
  }
}

const escenarios = [
  ...['claro', 'oscuro'].flatMap(m => [
    { nombre: `perfil-movil-${m}`, ruta: '/profile', movil: true, oscuro: m === 'oscuro' },
    { nombre: `perfil-escritorio-${m}`, ruta: '/profile', oscuro: m === 'oscuro' },
    { nombre: `saberes-movil-${m}`, ruta: '/saberes-previos', movil: true, oscuro: m === 'oscuro', elegirFicha: true },
    { nombre: `saberes-escritorio-${m}`, ruta: '/saberes-previos', oscuro: m === 'oscuro', elegirFicha: true },
  ]),
  { nombre: 'perfil-sin-carteras-movil', ruta: '/profile', movil: true, estado: { wallets: [] } },
  { nombre: 'perfil-error-carteras-movil', ruta: '/profile', movil: true, estado: { walletsError: true } },
  { nombre: 'saberes-sin-sesion-movil', ruta: '/saberes-previos', movil: true, estado: { sinSesion: true } },
  { nombre: 'saberes-vacio-sin-verificar-movil', ruta: '/saberes-previos', movil: true, estado: { sinSolicitudes: true, sinVerificar: true } },
  { nombre: 'saberes-error-movil', ruta: '/saberes-previos', movil: true, estado: { titularError: true } },
  { nombre: 'saberes-ingles-escritorio', ruta: '/saberes-previos', locale: 'en' },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const errores = []
for (const e of escenarios) {
  if (ONLY.length && !ONLY.some(o => e.nombre.includes(o))) {
    continue
  }
  const context = await browser.newContext({
    viewport: e.movil ? { width: 412, height: 915 } : { width: 1366, height: 900 },
    deviceScaleFactor: e.movil ? 2 : 1,
    isMobile: !!e.movil,
    hasTouch: !!e.movil,
    colorScheme: e.oscuro ? 'dark' : 'light',
    locale: e.locale === 'en' ? 'en-US' : 'es-MX',
  })
  await context.addInitScript(({ user }) => {
    localStorage.setItem('token', 'ficticio')
    localStorage.setItem('user', JSON.stringify(user))
  }, { user })
  if (e.locale) {
    await context.addCookies([{ name: 'certo_locale', value: e.locale, url: BASE }])
  }
  await context.route(`${API}/**`, responder(e.estado || {}))
  const page = await context.newPage()
  page.on('pageerror', err => errores.push(`${e.nombre}: ${err.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) {
      errores.push(`${e.nombre}: ${m.text()}`)
    }
  })
  await page.goto(BASE + e.ruta, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'nuxt-devtools-frame, #nuxt-devtools-container { display: none !important; }' })
  await page.evaluate(() => document.fonts.ready)
  if (e.elegirFicha) {
    await page.selectOption('#ficha-saberes', 'DEMO-EVAL').catch(() => {})
    await page.waitForSelector('[data-testid="saberes-ficha"]', { timeout: 5000 }).catch(() => {})
    await page.evaluate(() => document.querySelectorAll('.mc-saberes__evidencia details').forEach((d, i) => {
      if (i === 0) {
        d.open = true
      }
    }))
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${e.nombre}.png`, fullPage: true })
  await context.close()
}
await browser.close()
// eslint-disable-next-line no-console
console.log(errores.length ? `ERRORES:\n${[...new Set(errores)].join('\n')}` : 'sin errores de página')
