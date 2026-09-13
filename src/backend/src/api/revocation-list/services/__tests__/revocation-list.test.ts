import { revocationListExtension } from '../revocation-list'

function createFakeStrapi() {
  const profiles = new Map<number, any>([[1, { id: 1, name: 'Test Issuer' }]])
  const lists = new Map<number, any>()
  let nextId = 1

  return {
    strapi: {
      entityService: {
        findOne: async (contentType: string, id: number) => {
          if (contentType === 'api::profile.profile') return profiles.get(id) || null
          if (contentType === 'api::revocation-list.revocation-list') return lists.get(id) || null
          throw new Error(`Unexpected content type: ${contentType}`)
        },
        findMany: async (contentType: string, { filters }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          return [...lists.values()].filter(
            (list) => list.issuer === filters.issuer?.id && list.statusPurpose === filters.statusPurpose
          )
        },
        create: async (contentType: string, { data }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          const record = { id: nextId++, ...data }
          lists.set(record.id, record)
          return record
        },
        update: async (contentType: string, id: number, { data }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          const updated = { ...lists.get(id), ...data }
          lists.set(id, updated)
          return updated
        },
      },
    },
    lists,
  }
}

// Real Strapi 5 does not update a published Draft & Publish row in place:
// `entityService.update()` on an already-published entity deletes that row
// and creates a new draft/published pair under the same documentId, with a
// *different* numeric id for the published row. createFakeStrapi()'s update()
// above does not model this (it mutates the existing id in place), which is
// exactly why the bug this suite is guarding against slipped past the
// existing tests. This variant reproduces the real behavior.
function createFakeStrapiWithIdShiftingUpdate() {
  const profiles = new Map<number, any>([[1, { id: 1, name: 'Test Issuer' }]])
  const lists = new Map<number, any>()
  let nextId = 1

  return {
    strapi: {
      entityService: {
        findOne: async (contentType: string, id: number) => {
          if (contentType === 'api::profile.profile') return profiles.get(id) || null
          if (contentType === 'api::revocation-list.revocation-list') return lists.get(id) || null
          throw new Error(`Unexpected content type: ${contentType}`)
        },
        findMany: async (contentType: string, { filters }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          return [...lists.values()].filter(
            (list) => list.issuer === filters.issuer?.id && list.statusPurpose === filters.statusPurpose
          )
        },
        create: async (contentType: string, { data }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          const record = { id: nextId++, ...data }
          lists.set(record.id, record)
          return record
        },
        update: async (contentType: string, id: number, { data }: any) => {
          if (contentType !== 'api::revocation-list.revocation-list') throw new Error('unexpected content type')
          const previous = lists.get(id)
          lists.delete(id)
          const updated = { ...previous, ...data, id: nextId++ }
          lists.set(updated.id, updated)
          return updated
        },
      },
    },
    lists,
  }
}

describe('revocation-list service', () => {
  it('creates an empty status list for an issuer', async () => {
    const { strapi } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)

    const list = await service.createStatusListCredential(1)

    expect(list.issuer).toBe(1)
    expect(list.nextIndex).toBe(0)
    expect(list.statusListCredential).toMatch(/^urn:uuid:/)
  })

  it('getOrCreateActiveListForIssuer reuses an existing list', async () => {
    const { strapi, lists } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)

    const first = await service.getOrCreateActiveListForIssuer(1)
    const second = await service.getOrCreateActiveListForIssuer(1)

    expect(second.id).toBe(first.id)
    expect(lists.size).toBe(1)
  })

  it('assignNextIndex hands out sequential, non-repeating indices', async () => {
    const { strapi } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    const first = await service.assignNextIndex(list.id)
    const second = await service.assignNextIndex(list.id)

    expect(first.index).toBe(0)
    expect(second.index).toBe(1)
  })

  it('assignNextIndex returns an id that still resolves, even when update() replaces the row (real Strapi 5 Draft & Publish behavior)', async () => {
    const { strapi } = createFakeStrapiWithIdShiftingUpdate()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    const { index, statusListId } = await service.assignNextIndex(list.id)

    expect(index).toBe(0)
    // The id assignNextIndex hands back must be the one update() actually
    // produced, not the pre-update id -- the old id no longer resolves.
    expect(statusListId).not.toBe(list.id)
    expect(await strapi.entityService.findOne('api::revocation-list.revocation-list', statusListId)).not.toBeNull()
    expect(await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)).toBeNull()
  })

  it('checkStatusInList is false for an empty list', async () => {
    const { strapi } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    expect(await service.checkStatusInList(list, 0)).toBe(false)
  })

  it('revokeCredentialInStatusList flips the bit, checkStatusInList sees it', async () => {
    const { strapi } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)
    const { index } = await service.assignNextIndex(list.id)

    await service.revokeCredentialInStatusList(list.id, index)
    const updatedList = await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)

    expect(await service.checkStatusInList(updatedList, index)).toBe(true)
    expect(await service.checkStatusInList(updatedList, index + 1)).toBe(false)
  })

  it('revokeCredentialInStatusList is idempotent (revoking twice keeps one entry)', async () => {
    const { strapi } = createFakeStrapi()
    const service = revocationListExtension({ strapi } as any)
    const list = await service.createStatusListCredential(1)

    await service.revokeCredentialInStatusList(list.id, 5)
    await service.revokeCredentialInStatusList(list.id, 5)
    const updatedList = await strapi.entityService.findOne('api::revocation-list.revocation-list', list.id)

    expect(updatedList.encodedList).toBe('5')
  })
})
