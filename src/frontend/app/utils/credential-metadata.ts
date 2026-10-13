import { safeHttpUrl } from './portal'

const types: Record<string, string> = {
  MicroCredential: 'Microcredencial', Course: 'Curso', Certificate: 'Certificado',
  CertificateOfCompletion: 'Certificado de finalización', Diploma: 'Diploma',
  Badge: 'Insignia', Degree: 'Grado', Certification: 'Certificación',
  Achievement: 'Logro', Assessment: 'Evaluación', Competency: 'Competencia',
}
// Las credenciales emitidas por la consola antes del 12-oct-2026 llevan el campo de
// formación con su clave CINE-F delante («cinef_01 · Educación») y el criterio sin punto
// antes de «Ficha activada por…». Solo se arregla la presentación: lo firmado no cambia.
export function fieldOfStudyLabel(value: unknown) {
  return typeof value === 'string' ? value.replace(/^cinef_\d+\s*·\s*/i, '').trim() : ''
}
export function criteriaText(value: unknown) {
  if (typeof value !== 'string' || value === 'Criteria not specified') return ''
  return value.replace(/([^.!?…\s])\s+(Ficha activada por )/, '$1. $2').replace(/; instancia que decide: /, '. Instancia que decide: ')
}
export function credentialMetadata(credential: any, raw?: any) {
  const subject = credential?.credentialSubject || {}
  const achievement = subject.achievement || raw?.achievement || {}
  const alignments = achievement.alignment || achievement.alignments || []
  return {
    subject, achievement,
    holder: subject.name || raw?.recipient?.name,
    kind: types[achievement.achievementType] || 'Credencial',
    creator: achievement.creator?.name,
    event: subject.description || subject.narrative,
    outcomes: alignments.filter((a: any) => a.targetFramework === 'Resultados de aprendizaje' || a.targetType === 'ceasn:Competency'),
    levels: alignments.filter((a: any) => /Marco Nacional de Cualificaciones|Marco institucional/i.test(a.targetFramework || '')),
    otherAlignments: alignments.filter((a: any) => a.targetFramework !== 'Resultados de aprendizaje' && a.targetType !== 'ceasn:Competency' && !/Marco Nacional de Cualificaciones|Marco institucional/i.test(a.targetFramework || '')),
    credits: subject.creditsEarned ?? achievement.creditsAvailable,
    language: ({ es: 'Español', en: 'Inglés', fr: 'Francés', pt: 'Portugués' } as Record<string, string>)[achievement.inLanguage] || achievement.inLanguage,
    catalog: safeHttpUrl(achievement.criteria?.id || raw?.achievement?.criteria?.url),
    criteria: criteriaText(achievement.criteria?.narrative),
    fieldOfStudy: fieldOfStudyLabel(achievement.fieldOfStudy),
  }
}
export function qualificationLabel(alignment: any) {
  const label = alignment.targetName || alignment.targetCode || ''
  return label.replace(/^nivel_(\d+)(?:_(.+))?$/, (_: string, n: string, sub: string) => `Nivel ${n}${sub ? ` · ${sub}` : ''}`)
}
export function resolvedResults(credential: any) {
  const subject = credential?.credentialSubject
  return (subject?.result || []).map((result: any) => {
    const criterion = subject?.achievement?.resultDescription?.find((d: any) => d.id === result.resultDescription)
    const level = criterion?.rubricCriterionLevel?.find((l: any) => l.id === result.achievedLevel)
    return { name: criterion?.name || 'Criterio', value: level?.name || result.value || result.status || 'Sin nivel declarado', detail: level?.description }
  })
}
