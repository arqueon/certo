// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalLinkedin from '@/components/portal/PortalLinkedin.vue'
import PortalSiguientes from '@/components/portal/PortalSiguientes.vue'

const credencial = { name: 'Evaluación auténtica', organization: 'Universidad de Guadalajara', issued: '2026-10-07T12:00:00Z', expires: null, certId: 'urn:uuid:1', url: 'https://portal.test/credentials/1' }

describe('ideas de POK en el portal', () => {
  it('linkedIn: enlace prellenado en pestaña nueva y borrador con las habilidades', async () => {
    const wrapper = await mountSuspended(PortalLinkedin, { props: { credential: credencial, skills: ['Diseño de rúbricas'] } })
    const a = wrapper.get('a.mc-linkedin__agregar')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
    expect(new URL(a.attributes('href')!).searchParams.get('name')).toBe('Evaluación auténtica')
    expect(wrapper.get('pre').text()).toContain('Diseño de rúbricas')
  })
  it('para seguir aprendiendo: no aparece sin ofertas relacionadas', async () => {
    registerEndpoint('/portal/oferta-relacionada', () => ({ data: [] }))
    const wrapper = await mountSuspended(PortalSiguientes, { props: { clave: 'SIN-RELACION' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="seguir-aprendiendo"]').exists()).toBe(false)
  })
  it('para seguir aprendiendo: muestra la oferta, su motivo y el enlace de inscripción', async () => {
    registerEndpoint('/portal/oferta-relacionada', () => ({ data: [{ clave: 'UDG-DRU-1', nombre: 'Excel básico', tipo: 'Curso', horas: 40, modalidad: null, inscripcion: 'https://udgplus.udg.mx/excel-basico', motivo: { tipo: 'area', valor: 'Educación' } }] }))
    const wrapper = await mountSuspended(PortalSiguientes, { props: { clave: 'DEMO' } })
    await flushPromises()
    const tarjeta = wrapper.get('[data-testid="seguir-aprendiendo"] a')
    expect(tarjeta.attributes('href')).toBe('https://udgplus.udg.mx/excel-basico')
    expect(tarjeta.text()).toContain('Excel básico')
    expect(tarjeta.text()).toContain('Educación')
  })
})
