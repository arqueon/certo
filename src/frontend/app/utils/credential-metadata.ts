import { safeHttpUrl } from './portal'

const types: Record<string, string> = {
  MicroCredential: 'Microcredencial', Course: 'Curso', Certificate: 'Certificado',
  CertificateOfCompletion: 'Certificado de finalización', Diploma: 'Diploma',
  Badge: 'Insignia', Degree: 'Grado', Certification: 'Certificación',
  Achievement: 'Logro', Assessment: 'Evaluación', Competency: 'Competencia',
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
    criteria: achievement.criteria?.narrative === 'Criteria not specified' ? '' : achievement.criteria?.narrative,
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
