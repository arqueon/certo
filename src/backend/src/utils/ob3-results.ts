/**
 * Per-criterion results for an Open Badges 3.0 credential.
 *
 * OB 3.0 splits this in two: the Achievement carries `resultDescription`
 * (each rubric criterion and its levels), and the AchievementSubject
 * carries `result` (the level this learner reached, pointing back at a
 * resultDescription and one of its rubricCriterionLevel ids).
 *
 * Certo serializes the achievement live from the database, but a rubric
 * changes between versions. If resultDescription lived on the achievement,
 * publishing a new rubric would leave older credentials pointing at levels
 * that no longer exist. So both halves are stored on the credential, as a
 * snapshot of the rubric the learner was actually assessed with, and both
 * are covered by the signature.
 */

export interface RubricCriterionLevel {
  id: string
  type?: string[]
  name: string
  description?: string
  level?: string
  points?: string
}

export interface ResultDescription {
  id: string
  type?: string[]
  name: string
  resultType: string
  requiredLevel?: string
  rubricCriterionLevel?: RubricCriterionLevel[]
}

export interface Result {
  type?: string[]
  resultDescription: string
  achievedLevel?: string
  status?: string
  value?: string
}

export interface CredentialResults {
  resultDescription: ResultDescription[]
  result: Result[]
}

const URI = /^[a-z][a-z0-9+.-]*:\S+$/i

function requireUri(value: unknown, where: string): string {
  if (typeof value !== 'string' || !URI.test(value)) {
    throw new Error(`${where} must be a URI`)
  }
  return value
}

function requireName(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${where} is required`)
  }
  return value
}

/**
 * Validates and normalizes the results sent at issue time. Returns
 * undefined when neither half is present, so credentials without results
 * serialize exactly as they always have. Throws on anything a verifier
 * could not resolve: a result pointing at an unknown description, or an
 * achievedLevel that is not one of that description's levels.
 */
export function normalizeResults(
  resultDescription: unknown,
  result: unknown,
): CredentialResults | undefined {
  const hasDescriptions = Array.isArray(resultDescription) && resultDescription.length > 0
  const hasResults = Array.isArray(result) && result.length > 0
  if (!hasDescriptions && !hasResults) return undefined
  if (!hasDescriptions) throw new Error('result requires resultDescription')
  if (!hasResults) throw new Error('resultDescription requires result')

  const levelsByDescription = new Map<string, Set<string>>()

  const descriptions = (resultDescription as any[]).map((rd, i): ResultDescription => {
    const where = `resultDescription[${i}]`
    const id = requireUri(rd?.id, `${where}.id`)
    if (levelsByDescription.has(id)) throw new Error(`${where}.id is duplicated: ${id}`)

    const levels: RubricCriterionLevel[] = Array.isArray(rd.rubricCriterionLevel)
      ? rd.rubricCriterionLevel.map((l: any, j: number): RubricCriterionLevel => ({
          id: requireUri(l?.id, `${where}.rubricCriterionLevel[${j}].id`),
          type: ['RubricCriterionLevel'],
          name: requireName(l?.name, `${where}.rubricCriterionLevel[${j}].name`),
          ...(l.description ? { description: String(l.description) } : {}),
          ...(l.level !== undefined ? { level: String(l.level) } : {}),
          ...(l.points !== undefined ? { points: String(l.points) } : {}),
        }))
      : []
    const levelIds = new Set(levels.map((l) => l.id))
    levelsByDescription.set(id, levelIds)

    if (rd.requiredLevel !== undefined && !levelIds.has(rd.requiredLevel)) {
      throw new Error(`${where}.requiredLevel is not one of its rubricCriterionLevel ids`)
    }

    return {
      id,
      type: ['ResultDescription'],
      name: requireName(rd.name, `${where}.name`),
      resultType: requireName(rd.resultType, `${where}.resultType`),
      ...(rd.requiredLevel !== undefined ? { requiredLevel: rd.requiredLevel } : {}),
      ...(levels.length > 0 ? { rubricCriterionLevel: levels } : {}),
    }
  })

  const results = (result as any[]).map((r, i): Result => {
    const where = `result[${i}]`
    const descriptionId = requireUri(r?.resultDescription, `${where}.resultDescription`)
    const levels = levelsByDescription.get(descriptionId)
    if (!levels) throw new Error(`${where}.resultDescription does not match any resultDescription id`)
    if (r.achievedLevel !== undefined && !levels.has(r.achievedLevel)) {
      throw new Error(`${where}.achievedLevel is not a level of ${descriptionId}`)
    }
    return {
      type: ['Result'],
      resultDescription: descriptionId,
      ...(r.achievedLevel !== undefined ? { achievedLevel: r.achievedLevel } : {}),
      ...(r.status !== undefined ? { status: String(r.status) } : {}),
      ...(r.value !== undefined ? { value: String(r.value) } : {}),
    }
  })

  return { resultDescription: descriptions, result: results }
}
