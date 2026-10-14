import { describe, expect, it } from 'vitest'
import { linkedinAddUrl, linkedinPostText } from '../../utils/linkedin'

const credencial = { name: 'Evaluación auténtica', organization: 'Universidad de Guadalajara', issued: '2026-10-07T12:00:00Z', expires: '2028-10-07T12:00:00Z', certId: 'urn:uuid:1', url: 'https://portal.test/credentials/urn%3Auuid%3A1' }

describe('linkedIn', () => {
  it('prellena nombre, organización, fechas de emisión y vencimiento, ID y enlace', () => {
    const url = new URL(linkedinAddUrl(credencial))
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/profile/add')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: 'CERTIFICATION_NAME',
      name: 'Evaluación auténtica',
      organizationName: 'Universidad de Guadalajara',
      issueYear: '2026',
      issueMonth: '10',
      expirationYear: '2028',
      expirationMonth: '10',
      certId: 'urn:uuid:1',
      certUrl: credencial.url,
    })
  })
  it('omite fechas inválidas o ausentes y usa organizationId si se pide', () => {
    const url = new URL(linkedinAddUrl({ ...credencial, issued: 'no', expires: null }, { organizationId: '53115782' }))
    expect(url.searchParams.has('issueYear')).toBe(false)
    expect(url.searchParams.has('expirationYear')).toBe(false)
    expect(url.searchParams.get('organizationId')).toBe('53115782')
    expect(url.searchParams.has('organizationName')).toBe(false)
  })
  it('arma el texto sugerido con habilidades, enlace y etiquetas sin acentos', () => {
    const t = (key: string, p: Record<string, unknown> = {}) => `${key.split('.').pop()}:${Object.values(p).join('|')}`
    const texto = linkedinPostText({ ...credencial, skills: ['Evaluación auténtica', 'Diseño de rúbricas'] }, t)
    expect(texto).toBe([
      'intro:Evaluación auténtica|Universidad de Guadalajara',
      'skills:Evaluación auténtica, Diseño de rúbricas',
      `verify:${credencial.url}`,
      '#EvaluacionAutentica #DisenoDeRubricas',
    ].join('\n\n'))
    expect(linkedinPostText(credencial, t).split('\n\n')).toHaveLength(2)
  })
})
