import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, afterEach } from 'vitest'
import HolderWallet from '@/components/HolderWallet.vue'
import { apiClient } from '@/api/api-client'
import { walletCountdown, shortWalletDid } from '@/utils/wallet'

afterEach(() => { vi.restoreAllMocks() })
const summary = { eligible: true, legacy: false, walletCount: 0, copies: [] }
describe('holder wallet', () => {
  it('prepares a QR and mobile link only after the holder acts', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: summary })
    const walletUrl = 'https://lcw.app/request.html?request=%7B%7D'
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { walletUrl, qrContent: walletUrl, expiresAt: new Date(Date.now() + 600000).toISOString() } })
    const wrapper = await mountSuspended(HolderWallet, { props: { credentialId: 'urn:uuid:fixture' } })
    await flushPromises()
    expect(post).not.toHaveBeenCalled()
    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('img').exists()).toBe(true))
    expect(post).toHaveBeenCalledWith('/api/holder/credentials/urn%3Auuid%3Afixture/wallet-offer', {})
    expect(wrapper.find('img').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(wrapper.find('a.wallet-open').attributes('href')).toBe(walletUrl)
    expect(wrapper.find('[role="timer"]').text()).toContain('10:00')
    wrapper.unmount()
  })
  it('explains legacy reissuance and prevents offer creation', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { ...summary, eligible: false, legacy: true } })
    const post = vi.spyOn(apiClient, 'post')
    const wrapper = await mountSuspended(HolderWallet, { props: { credentialId: 'legacy' } })
    await flushPromises()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('reissue')
    expect(post).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('removes expired QR and link and allows a new offer', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: summary })
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { walletUrl: 'https://lcw.app/', qrContent: 'expired', expiresAt: '2000-01-01T00:00:00Z' } })
    const wrapper = await mountSuspended(HolderWallet, { props: { credentialId: 'fixture' } })
    await flushPromises(); await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('expired'))
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('a.wallet-open').exists()).toBe(false)
    expect(wrapper.text()).toContain('Generate a new one')
    wrapper.unmount()
  })
  it('shows DID/date and joint revocation without a misleading revoke button', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { ...summary, walletCount: 1, copies: [{ holderDid: 'did:key:' + 'x'.repeat(40), boundAt: '2026-10-04T12:00:00Z', credentialId: 'copy' }] } })
    const wrapper = await mountSuspended(HolderWallet, { props: { credentialId: 'fixture' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Saved to 1 wallet')
    expect(wrapper.find('abbr').attributes('title')).toContain('did:key:')
    expect(wrapper.find('time').attributes('datetime')).toBe('2026-10-04T12:00:00Z')
    expect(wrapper.text()).toContain('cannot be revoked separately')
    wrapper.unmount()
  })
  it('clamps countdown and abbreviates only long DIDs', () => {
    expect(walletCountdown('2026-10-04T12:00:00Z', Date.parse('2026-10-04T11:59:01Z'))).toBe('0:59')
    expect(walletCountdown('2000-01-01', Date.now())).toBe('0:00')
    expect(walletCountdown('invalid', Date.now())).toBe('0:00')
    expect(shortWalletDid('did:web:example.org')).toBe('did:web:example.org')
  })
})
