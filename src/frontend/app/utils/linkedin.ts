// «Agregar a LinkedIn» (ideas de POK, VoBo de Rubén del 13-oct-2026): el
// formulario de certificación de LinkedIn llega con nombre, organización,
// fechas, ID y enlace ya llenos, y un texto sugerido para publicarla.
export interface LinkedinCredential {
  name: string
  organization: string
  issued?: string | null
  expires?: string | null
  certId: string
  url: string
}

function yearMonth(value?: string | null) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? { year: String(date.getFullYear()), month: String(date.getMonth() + 1) } : null
}

/** URL de «Agregar a mi perfil» de LinkedIn con los campos de la certificación. */
export function linkedinAddUrl(c: LinkedinCredential, { organizationId }: { organizationId?: string } = {}) {
  const issued = yearMonth(c.issued)
  const expires = yearMonth(c.expires)
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: c.name,
    ...(organizationId ? { organizationId } : { organizationName: c.organization }),
    ...(issued ? { issueYear: issued.year, issueMonth: issued.month } : {}),
    ...(expires ? { expirationYear: expires.year, expirationMonth: expires.month } : {}),
    certId: c.certId,
    certUrl: c.url,
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

/** Borrador de publicación: en primera persona, breve, con habilidades y el enlace de verificación. */
export function linkedinPostText(c: LinkedinCredential & { skills?: string[] }, t: (key: string, params?: Record<string, unknown>) => string) {
  const skills = (c.skills || []).filter(Boolean).slice(0, 6)
  return [
    t('portal.b.linkedin.post.intro', { name: c.name, organization: c.organization }),
    skills.length ? t('portal.b.linkedin.post.skills', { skills: skills.join(', ') }) : '',
    t('portal.b.linkedin.post.verify', { url: c.url }),
    skills.length ? skills.map(s => `#${s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Z0-9]+(.)?/gi, (_m, ch: string | undefined) => (ch || '').toUpperCase()).replace(/^./, ch => ch.toUpperCase())}`).join(' ') : '',
  ].filter(Boolean).join('\n\n')
}
