import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, afterEach } from 'vitest'
import HolderWallets from '@/components/HolderWallets.vue'
import { apiClient } from '@/api/api-client'

afterEach(() => vi.restoreAllMocks())
const wallets = [
  { id: 1, kind: 'account', client: 'web', name: 'Cartera UDGPlus', addedAt: '2026-10-07T10:00:00Z', credentials: 3, lastSavedAt: '2026-10-07T10:00:00Z' },
  { id: 2, kind: 'device', client: 'app', name: null, addedAt: '2026-10-05T10:00:00Z', credentials: 1, lastSavedAt: null },
  { id: 3, kind: 'device', client: null, name: null, addedAt: '2026-10-04T10:00:00Z', credentials: 1, lastSavedAt: null },
]
describe('holder wallets', () => {
  it('lists wallets by kind and counts, without DIDs', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: wallets })
    const wrapper = await mountSuspended(HolderWallets)
    await flushPromises()
    expect(wrapper.text()).toContain('Cartera UDGPlus (web)')
    expect(wrapper.text()).toContain("in your account's name")
    expect(wrapper.text()).toContain('Phone app')
    expect(wrapper.text()).toContain('Unidentified wallet')
    expect(wrapper.text()).toContain('3 credentials saved')
    expect(wrapper.text()).toContain('1 credential saved')
    expect(wrapper.text()).not.toContain('did:')
    wrapper.unmount()
  })
  it('asks before removing and reloads after', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: wallets }).mockResolvedValueOnce({ data: [wallets[0]] })
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue(undefined as any)
    const wrapper = await mountSuspended(HolderWallets)
    await flushPromises()
    await wrapper.findAll('button.wallet-remove')[1]!.trigger('click')
    expect(del).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('will not receive new copies')
    await wrapper.find('button.brand-button').trigger('click')
    await flushPromises()
    expect(del).toHaveBeenCalledWith('/api/holder/wallets/2')
    expect(get).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('Phone app')
    wrapper.unmount()
  })
  it('explains an empty list', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] })
    const wrapper = await mountSuspended(HolderWallets)
    await flushPromises()
    expect(wrapper.text()).toContain('no wallets yet')
    wrapper.unmount()
  })
})
