import { describe, expect, it } from 'vitest'
import { credentialMetadata, criteriaText, fieldOfStudyLabel, qualificationLabel, resolvedResults } from '../../utils/credential-metadata'
describe('presentación 0023', () => {
  it('muestra nombre firmado, tipo español y nivel declarado', () => {
    const info = credentialMetadata({ credentialSubject: { name: 'Titular firmada', term: '2026-B', creditsEarned: 0, achievement: { achievementType: 'MicroCredential', inLanguage: 'es', creditsAvailable: 2, alignment: [{ targetName: 'nivel_6', targetFramework: 'Marco Nacional de Cualificaciones (SEP)' }] } } }, { recipient: { name: 'Perfil modificado' } })
    expect(info.holder).toBe('Titular firmada'); expect(info.kind).toBe('Microcredencial')
    expect(info.credits).toBe(0); expect(info.language).toBe('Español')
    expect(qualificationLabel(info.levels[0])).toBe('Nivel 6')
  })
  it('resuelve achievedLevel contra la rúbrica, sin mostrar URI técnica', () => {
    const result = resolvedResults({ credentialSubject: { result: [{ resultDescription: 'urn:criterion', achievedLevel: 'urn:level' }], achievement: { resultDescription: [{ id: 'urn:criterion', name: 'Interpretar datos', rubricCriterionLevel: [{ id: 'urn:level', name: 'Logrado', level: '2' }] }] } } })
    expect(result).toEqual([{ name: 'Interpretar datos', value: 'Logrado', detail: undefined }])
  })
  it('presenta datos antiguos sin fabricar metadatos ni enlaces inseguros', () => {
    const info = credentialMetadata({}, { recipient: { name: 'Titular' }, achievement: { criteria: { url: 'javascript:x', narrative: 'Criteria not specified' } } })
    expect(info.holder).toBe('Titular'); expect(info.levels).toEqual([])
    expect(info.catalog).toBe(''); expect(info.criteria).toBe('')
  })
  it('limpia en pantalla la clave CINE-F y la puntuación de credenciales ya emitidas', () => {
    expect(fieldOfStudyLabel('cinef_01 · Educación')).toBe('Educación')
    expect(fieldOfStudyLabel('Educación')).toBe('Educación')
    expect(criteriaText('Evaluación previa; Rúbrica versión 1 Ficha activada por demo.metadatos; instancia que decide: DGUV.'))
      .toBe('Evaluación previa; Rúbrica versión 1. Ficha activada por demo.metadatos. Instancia que decide: DGUV.')
    const nuevo = 'Rúbrica versión 1. Ficha activada por Gestora. Instancia que decide: UDG+.'
    expect(criteriaText(nuevo)).toBe(nuevo)
    expect(credentialMetadata({ credentialSubject: { achievement: { fieldOfStudy: 'cinef_06 · TIC' } } }).fieldOfStudy).toBe('TIC')
  })
})
