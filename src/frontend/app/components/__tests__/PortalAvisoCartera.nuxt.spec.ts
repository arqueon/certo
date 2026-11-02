import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/api-client'
import PortalAvisoCartera from '@/components/portal/PortalAvisoCartera.vue'

const pendiente = { offerId: 9, credentialId: 'urn:uuid:x', credentialName: 'Diseño instruccional con IA', client: 'web' as const, name: 'Cartera UdeG', requestedAt: '2026-10-14T02:36:00Z', expiresAt: '2026-10-14T02:46:00Z' }
afterEach(() => { vi.restoreAllMocks(); useCarteraPendiente().pendientes.value = [] })

describe('aviso global de cartera nueva', () => {
  it('names the wallet and the credential, and answers from any page without a reload', async () => {
    const carteras = useCarteraPendiente()
    carteras.pendientes.value = [pendiente]
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined as any)
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] })
    const wrapper = await mountSuspended(PortalAvisoCartera)
    const aviso = wrapper.find('[data-testid="aviso-cartera"]')
    expect(aviso.text()).toContain('Diseño instruccional con IA')
    expect(aviso.text()).toContain('Cartera UdeG (web)')
    expect(aviso.text()).not.toContain('did:')
    const version = carteras.version.value
    await wrapper.find('button.aviso-approve').trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/api/holder/wallet-offers/9/decision', { approve: true })
    expect(wrapper.find('[data-testid="aviso-cartera"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(carteras.version.value).toBe(version + 1)
    wrapper.unmount()
  })
  it('stays hidden while no wallet is waiting', async () => {
    const wrapper = await mountSuspended(PortalAvisoCartera)
    expect(wrapper.find('[data-testid="aviso-cartera"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
