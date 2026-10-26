// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/api-client'
import PortalPerfil from '@/components/portal/PortalPerfil.vue'
import SolicitudTitularB from '@/components/saberes/SolicitudTitularB.vue'

afterEach(() => vi.restoreAllMocks())

describe('perfil del titular (dirección B)', () => {
  it('muestra los datos de la cuenta, qué es público y las carteras vinculadas', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] })
    const auth = useAuthStore()
    auth.user = { id: 8, username: 'ana.lopez', email: 'ana@example.invalid', createdAt: '2026-09-01T12:00:00Z' } as any
    auth.profile = { id: 7, name: 'Ana López Ruiz', email: 'ana@example.invalid', profileType: 'Recipient' }
    const wrapper = await mountSuspended(PortalPerfil)
    await flushPromises()
    expect(wrapper.get('[data-testid="perfil-nombre"]').text()).toBe('Ana López Ruiz')
    expect(wrapper.text()).toContain('ana@example.invalid')
    expect(wrapper.get('[data-testid="perfil-privacidad"]').text()).toContain('Your email is not shown')
    expect(wrapper.get('[data-testid="perfil-carteras"]').text()).toContain('2 linked wallets')
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })
  it('descarga los datos desde el endpoint de portabilidad', async () => {
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => url === '/api/profiles/me/export' ? { profile: {} } : { data: [] })
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const wrapper = await mountSuspended(PortalPerfil)
    await flushPromises()
    await wrapper.get('[data-testid="perfil-exportar"]').trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/api/profiles/me/export')
    expect(createObjectURL).toHaveBeenCalled()
    wrapper.unmount()
  })
})

const base = { referencia: 'SP-1', createdAt: '2026-10-01T15:00:00Z', fechaLimite: '2026-10-15', descripcionSaberes: 'Diseño rúbricas', logro: { clave: 'DEMO', nombre: 'Evaluación auténtica' }, instanciaDestinataria: 'Instancia de ejemplo' }
describe('solicitud de saberes previos (dirección B)', () => {
  it('en revisión: segundo paso activo y plazo visible', async () => {
    const wrapper = await mountSuspended(SolicitudTitularB, { props: { solicitud: { ...base, estado: 'en_revision' }, correoVerificado: true } })
    expect(wrapper.get('[data-testid="solicitud-estado"]').text()).toBe('Under review')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Under review')
    expect(wrapper.text()).toContain('Answer by')
  })
  it('reconocida con credencial emitida: los cuatro pasos hechos y enlace a credenciales', async () => {
    const wrapper = await mountSuspended(SolicitudTitularB, { props: { solicitud: { ...base, estado: 'reconocida', estadoCredencial: 'emitida', justificacion: 'Cumple' }, correoVerificado: true } })
    expect(wrapper.findAll('.mc-solicitud__paso--hecho')).toHaveLength(4)
    expect(wrapper.text()).toContain('Credential: issued')
    expect(wrapper.find('a[href="/dashboard"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Answer by')
  })
  it('no reconocida: ofrece completar, reabrir o presentar otra', async () => {
    const wrapper = await mountSuspended(SolicitudTitularB, { props: { solicitud: { ...base, estado: 'no_procede', subsanable: true, justificacion: 'Falta evidencia' }, correoVerificado: true } })
    expect(wrapper.get('[data-testid="solicitud-estado"]').classes()).toContain('mc-chip--no')
    const botones = wrapper.findAll('button').map(b => b.text())
    expect(botones).toEqual(expect.arrayContaining(['Complete request', 'Ask to reopen', 'Submit a new request']))
  })
})
