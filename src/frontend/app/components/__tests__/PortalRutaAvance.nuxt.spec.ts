// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalRutaAvance from '@/components/portal/PortalRutaAvance.vue'

const cred = (clave: string, extra: Record<string, unknown> = {}) => ({ id: clave, name: clave, achievement: { metadata0023: { humanCode: clave } }, ...extra })
const ruta = {
  clave: 'RUTA-1', nombre: 'Ruta en herramientas digitales', url: 'https://catalogo.test/publico/catalogo/RUTA-1',
  avance: 'https://catalogo.test/api/publico/catalogo/rutas/RUTA-1/avance',
  pasos: [
    { clave: 'A', nombre: 'Excel' },
    { clave: 'B', nombre: 'Habilitación' },
    { clave: 'C', nombre: 'Servicio', inscripcion: 'https://microcredenciales.udg.mx/servicio' },
  ],
}

describe('vista de avance de rutas', () => {
  it('muestra «2 de 3», la insignia de avance y el paso que falta con su oferta', async () => {
    let pedidos = ''
    registerEndpoint('/portal/rutas', (event: any) => {
      pedidos = new URL(event.node.req.url, 'http://x').searchParams.get('pasos') || ''
      return { data: [ruta] }
    })
    const wrapper = await mountSuspended(PortalRutaAvance, { props: { credentials: [cred('A'), cred('B'), cred('C', { revoked: true })] } })
    await flushPromises()
    // Solo se preguntan las fichas de credenciales vigentes.
    expect(pedidos.split(',').sort()).toEqual(['A', 'B'])
    const tarjeta = wrapper.get('[data-ruta="RUTA-1"]')
    expect(tarjeta.text()).toContain('2 of 3')
    expect(tarjeta.get('img').attributes('src')).toBe(`${ruta.avance}?hechos=2`)
    const falta = tarjeta.get('a[href="https://microcredenciales.udg.mx/servicio"]')
    expect(falta.attributes('target')).toBe('_blank')
  })
  it('con foco, solo las rutas de esa ficha; una ruta ya recibida se muestra completada', async () => {
    registerEndpoint('/portal/rutas', () => ({ data: [ruta, { ...ruta, clave: 'RUTA-2', nombre: 'Otra', pasos: [{ clave: 'X', nombre: 'X' }, { clave: 'Y', nombre: 'Y' }] }] }))
    const wrapper = await mountSuspended(PortalRutaAvance, { props: { foco: 'A', credentials: [cred('A'), cred('B'), cred('C'), cred('RUTA-1'), cred('X')] } })
    await flushPromises()
    expect(wrapper.findAll('[data-ruta]').map(n => n.attributes('data-ruta'))).toEqual(['RUTA-1'])
    expect(wrapper.text()).toContain('Pathway completed')
  })
  it('no aparece si ninguna ruta incluye sus credenciales', async () => {
    registerEndpoint('/portal/rutas', () => ({ data: [] }))
    const wrapper = await mountSuspended(PortalRutaAvance, { props: { credentials: [cred('A')] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="ruta-avance"]').exists()).toBe(false)
  })
})
