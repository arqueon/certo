import { defineEventHandler, getQuery, setHeader } from 'h3'

// «Para seguir aprendiendo» (ideas de POK, VoBo del 13-oct-2026): el
// portal pide a la consola, desde el servidor, hasta 3 ofertas institucionales
// relacionadas con la ficha de una credencial. Del lado del servidor no hace
// falta CORS y la VM puede usar la red interna (NUXT_CATALOG_API_URL). Ante
// cualquier falla responde una lista vacía: el bloque simplemente no aparece.
// Va en /portal y no en /api: en el borde, /api/* es del backend de Certo.
interface Oferta { clave: string | null, nombre: string | null, tipo: string | null, horas: number | null, modalidad: string | null, inscripcion: string, imagen?: string, motivo: { tipo: string, valor: string } }
const cache = new Map<string, { hasta: number, data: Oferta[] }>()
const VIGENCIA = 10 * 60 * 1000

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
    return ''
  }
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''
  }
  catch {
    return ''
  }
}
const texto = (v: unknown, max = 300) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const publico = origen(config.public.catalogUrl || '')
  const interno = String(config.catalogApiUrl || '').replace(/\/$/, '') || publico
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  if (!interno || !publico) {
    return { data: [] }
  }
  const q = getQuery(event)
  const clave = typeof q.clave === 'string' && /^[\w.-]{1,64}$/.test(q.clave) ? q.clave : ''
  const nombre = typeof q.nombre === 'string' && q.nombre.trim() && q.nombre.length <= 300 ? q.nombre.trim() : ''
  if (!clave && !nombre) {
    return { data: [] }
  }
  const llave = `${clave}|${nombre}`
  const guardada = cache.get(llave)
  if (guardada && guardada.hasta > Date.now()) {
    return { data: guardada.data }
  }
  try {
    const consulta = new URLSearchParams({ ...(clave ? { clave } : {}), ...(nombre ? { nombre } : {}) })
    const r: any = await $fetch(`${interno}/api/publico/catalogo/relacionadas?${consulta}`, { timeout: 4000 })
    const data: Oferta[] = (Array.isArray(r?.data) ? r.data : []).slice(0, 3).map((o: any) => ({
      clave: texto(o.clave, 64),
      nombre: texto(o.nombre),
      tipo: texto(o.tipo, 80),
      horas: Number.isFinite(Number(o.horas)) && Number(o.horas) > 0 ? Number(o.horas) : null,
      modalidad: texto(o.modalidad, 80),
      inscripcion: https(o.inscripcion),
      // La imagen la sirve el catálogo público: se devuelve con su origen público, no el interno.
      ...(typeof o.imagen === 'string' && o.imagen.startsWith('/api/publico/catalogo/') ? { imagen: `${publico}${o.imagen}` } : {}),
      motivo: { tipo: texto(o.motivo?.tipo, 20) || '', valor: texto(o.motivo?.valor, 120) || '' },
    })).filter((o: Oferta) => o.clave && o.nombre && o.inscripcion)
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
