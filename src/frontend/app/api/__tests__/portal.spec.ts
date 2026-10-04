import { describe, it, expect } from 'vitest'
import { brandActive, contrastText, credentialIdentifier, safeHttpUrl } from '../../utils/portal'

describe('institutional portal', () => {
  it('activates only when a brand variable is provided', () => {
    expect(brandActive({})).toBe(false)
    expect(brandActive({ brandName: '', brandPrimaryColor: '' })).toBe(false)
    expect(brandActive({ brandName: 'UDGPlus' })).toBe(true)
    expect(brandActive({ brandPrimaryColor: '#002d54' })).toBe(true)
  })
  it.each(['urn:uuid:abcd', '42'])('accepts bare and encoded credential identifiers %s', id => {
    expect(credentialIdentifier(` ${id} `)).toBe(id)
    expect(credentialIdentifier(`https://example.test/credentials/${encodeURIComponent(id)}?source=cv#badge`)).toBe(id)
    expect(credentialIdentifier(`https://example.test/api/credentials/${encodeURIComponent(id)}/verify`)).toBe(id)
    expect(credentialIdentifier(`https://example.test/verify/${encodeURIComponent(id)}`)).toBe(id)
  })
  it('does not interpret arbitrary URLs as credentials or allow unsafe catalog links', () => {
    expect(() => credentialIdentifier('https://example.test/login')).toThrow()
    expect(safeHttpUrl('javascript:alert(1)')).toBe('')
    expect(safeHttpUrl('https://catalog.example.test/skill')).toBe('https://catalog.example.test/skill')
  })
  it('chooses a WCAG AA foreground across a representative color cube', () => {
    function luminance(hex: string) {
      const c = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      return c[0]! * .2126 + c[1]! * .7152 + c[2]! * .0722
    }
    for (const r of [0, 64, 128, 192, 255]) for (const g of [0, 64, 128, 192, 255]) for (const b of [0, 64, 128, 192, 255]) {
      const bg = `#${[r,g,b].map(n => n.toString(16).padStart(2, '0')).join('')}`
      const l1 = luminance(bg), l2 = luminance(contrastText(bg))
      expect((Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastText('#002d54')).toBe('#ffffff')
  })
})
