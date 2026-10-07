import {
  authenticatedPermissions,
  authenticatedRoleMode,
  permissionsToPrune,
} from '../permissions-setup'

const ISSUER_SIDE = [
  'api::credential.credential.issue',
  'api::credential.credential.revoke',
  'api::credential.credential.create',
  'api::credential.credential.delete',
  'api::profile.profile.rotateSigningKey',
  'api::profile.profile.importMyData',
  'api::achievement.achievement.create',
]

describe('authenticatedRoleMode', () => {
  it('defaults to issuer, matching the upstream behavior', () => {
    expect(authenticatedRoleMode(undefined)).toBe('issuer')
    expect(authenticatedRoleMode('')).toBe('issuer')
    expect(authenticatedRoleMode('anything')).toBe('issuer')
  })

  it('accepts holder regardless of case and spaces', () => {
    expect(authenticatedRoleMode('holder')).toBe('holder')
    expect(authenticatedRoleMode(' Holder ')).toBe('holder')
  })
})

describe('authenticatedPermissions', () => {
  it('keeps the issuer-side actions in issuer mode', () => {
    const list = authenticatedPermissions('issuer')
    for (const action of ISSUER_SIDE) expect(list).toContain(action)
  })

  it('leaves out every issuer-side action in holder mode', () => {
    const list = authenticatedPermissions('holder')
    for (const action of ISSUER_SIDE) expect(list).not.toContain(action)
    expect(list).toContain('api::profile.profile.myReceivedCredentials')
    expect(list).toContain('api::credential.credential.export')
  })
})

describe('permissionsToPrune', () => {
  it('returns the linked actions outside the allowed list', () => {
    const linked = ['api::credential.credential.find', 'api::credential.credential.issue', 'api::profile.profile.rotateSigningKey']
    expect(permissionsToPrune(linked, authenticatedPermissions('holder'))).toEqual([
      'api::credential.credential.issue',
      'api::profile.profile.rotateSigningKey',
    ])
  })

  it('returns nothing when the role already matches', () => {
    const holder = authenticatedPermissions('holder')
    expect(permissionsToPrune(holder, holder)).toEqual([])
  })
})
