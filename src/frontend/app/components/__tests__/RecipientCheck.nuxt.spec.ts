// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RecipientCheck from '@/components/RecipientCheck.vue'
import { apiClient } from '@/api/api-client'

describe('recipient check', () => {
  it.each([true, false])('submits privately by POST and explains matches=%s', async matches => {
    const check = vi.spyOn(apiClient, 'checkRecipient').mockResolvedValue({ matches })
    const wrapper = await mountSuspended(RecipientCheck, { props: { credentialId: 'urn:uuid:test' } })
    await wrapper.get('input').setValue('person@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(check).toHaveBeenCalledWith('urn:uuid:test', 'person@example.test')
    expect(wrapper.get('[role="status"]').text()).toBe(matches ? 'The email matches this credential.' : 'The email does not match this credential.')
    await wrapper.get('input').setValue('other@example.test')
    expect(wrapper.get('[role="status"]').text()).toBe('')
    wrapper.unmount(); check.mockRestore()
  })
  it('shows an unavailable result on 404 or rate limit, never a false mismatch', async () => {
    const check = vi.spyOn(apiClient, 'checkRecipient').mockRejectedValue(new Error('unavailable'))
    const wrapper = await mountSuspended(RecipientCheck, { props: { credentialId: 'urn:uuid:test' } })
    await wrapper.get('input').setValue('person@example.test')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('The email could not be checked.')
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'))
    wrapper.unmount(); check.mockRestore()
  })
  it('discards an in-flight response after the credential changes', async () => {
    let resolve!: (value: { matches: boolean }) => void
    const check = vi.spyOn(apiClient, 'checkRecipient').mockImplementation(() => new Promise(done => { resolve = done }))
    const wrapper = await mountSuspended(RecipientCheck, { props: { credentialId: 'urn:uuid:first' } })
    await wrapper.get('input').setValue('person@example.test')
    await wrapper.get('form').trigger('submit')
    await wrapper.setProps({ credentialId: 'urn:uuid:second' })
    resolve({ matches: true }); await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    wrapper.unmount(); check.mockRestore()
  })
})
