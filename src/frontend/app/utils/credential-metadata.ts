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
// Habilidades (consola desde 14-oct-2026): alignment ceasn:Competency en este marco.
// targetDescription «Respaldada por RA1: …» dice qué resultado las respalda.
export const SKILLS_FRAMEWORK = 'Habilidades UdeG'
// Nombre del marco en las credenciales emitidas antes del cambio de identidad
// (oct-2026): se siguen leyendo como habilidades; no se emite más con él.
export const LEGACY_SKILLS_FRAMEWORKS = ['Habilidades UDGPlus']
const isSkill = (a: any) => a?.targetFramework === SKILLS_FRAMEWORK || LEGACY_SKILLS_FRAMEWORKS.includes(a?.targetFramework)
export function skillsOf(alignments: any[]) {
  return alignments.filter(isSkill).map((a: any) => ({
    name: String(a.targetName || ''),
    result: /^Respaldada por ([^:\s]+):/.exec(a.targetDescription || '')?.[1] || '',
    support: typeof a.targetDescription === 'string' ? a.targetDescription : '',
    url: safeHttpUrl(a.targetUrl),
  })).filter(s => s.name)
}
/** Ancla estable de un resultado dentro de la página («ra-RA1»). */
export function resultAnchor(code: string) {
  return `ra-${String(code).replace(/[^\w-]/g, '')}`
}
/** Dominio que respalda la firma cuando el emisor es did:web («did:web:a.b%3A8443:x» → «a.b:8443»). */
export function didWebDomain(issuer: any) {
  const id = typeof issuer === 'string' ? issuer : issuer?.id
  if (typeof id !== 'string' || !id.startsWith('did:web:')) {
    return ''
  }
  try {
    return decodeURIComponent(id.slice(8).split(':')[0] || '')
  }
  catch {
    return ''
  }
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
    outcomes: alignments.filter((a: any) => !isSkill(a) && (a.targetFramework === 'Resultados de aprendizaje' || a.targetType === 'ceasn:Competency')),
    skills: skillsOf(alignments),
    levels: alignments.filter((a: any) => /Marco Nacional de Cualificaciones|Marco institucional/i.test(a.targetFramework || '')),
    otherAlignments: alignments.filter((a: any) => !isSkill(a) && a.targetFramework !== 'Resultados de aprendizaje' && a.targetType !== 'ceasn:Competency' && !/Marco Nacional de Cualificaciones|Marco institucional/i.test(a.targetFramework || '')),
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
