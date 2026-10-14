import { defineEventHandler, getQuery, setHeader } from 'h3'

// Vista de avance de las rutas apilables (adenda 0026, 14-oct-2026). El cliente
// manda las claves de las fichas de sus credenciales (?pasos=A,B); el portal
// pregunta a la consola, desde el servidor, qué rutas activas las incluyen y
// con qué pasos. Son datos públicos del catálogo: nada de la persona sale del
// portal, y el avance («2 de 3») se calcula en el navegador con sus propias
// credenciales. Ante cualquier falla responde una lista vacía.
interface Paso { clave: string, nombre: string, url?: string, inscripcion?: string }
interface Ruta { clave: string, nombre: string, url?: string, avance: string, pasos: Paso[] }
const cache = new Map<string, { hasta: number, data: Ruta[] }>()
const VIGENCIA = 10 * 60 * 1000
const CLAVE = /^[\w.-]{1,64}$/

function origen(url: string) {
  try {
    return new URL(url).origin
  }
  catch {
    return ''
  }
}
function https(url: unknown) {
  if (typeof url !== 'string') {
    return undefined
  }
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined
  }
  catch {
    return undefined
  }
}
const texto = (v: unknown, max = 300) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : ''

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const publico = origen(config.public.catalogUrl || '')
  const interno = String(config.catalogApiUrl || '').replace(/\/$/, '') || publico
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  if (!interno || !publico) {
    return { data: [] }
  }
  const pasos = [...new Set(String(getQuery(event).pasos || '').split(',').map(c => c.trim()).filter(c => CLAVE.test(c)))].sort().slice(0, 20)
  if (!pasos.length) {
    return { data: [] }
  }
  const llave = pasos.join(',')
  const guardada = cache.get(llave)
  if (guardada && guardada.hasta > Date.now()) {
    return { data: guardada.data }
  }
  try {
    const r: any = await $fetch(`${interno}/api/publico/catalogo/rutas?pasos=${encodeURIComponent(llave)}`, { timeout: 4000 })
    const data: Ruta[] = (Array.isArray(r?.data) ? r.data : []).map((ruta: any) => ({
      clave: texto(ruta.clave, 64),
      nombre: texto(ruta.nombre),
      url: https(ruta.url),
      // La insignia de avance la sirve el catálogo público; el cliente añade ?hechos=N.
      avance: CLAVE.test(texto(ruta.clave, 64)) ? `${publico}/api/publico/catalogo/rutas/${encodeURIComponent(ruta.clave)}/avance` : '',
      pasos: (Array.isArray(ruta.pasos) ? ruta.pasos : []).map((p: any) => ({
        clave: texto(p.clave, 64), nombre: texto(p.nombre), url: https(p.url), inscripcion: https(p.inscripcion),
      })).filter((p: Paso) => CLAVE.test(p.clave) && p.nombre),
    })).filter((ruta: Ruta) => CLAVE.test(ruta.clave) && ruta.nombre && ruta.pasos.length >= 2)
    cache.set(llave, { hasta: Date.now() + VIGENCIA, data })
    if (cache.size > 500) {
      cache.delete(cache.keys().next().value!)
    }
    return { data }
  }
  catch {
    return { data: [] }
  }
})
