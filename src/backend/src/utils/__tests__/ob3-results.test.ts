import { normalizeResults } from '../ob3-results'

const base = 'urn:example:rubric:v1:criterion:C1'

function description(overrides: Record<string, unknown> = {}) {
  return {
    id: base,
    name: 'Argumentation',
    resultType: 'RubricCriterionLevel',
    rubricCriterionLevel: [
      { id: `${base}:level:1`, name: 'Initial', level: 1, points: 1 },
      { id: `${base}:level:3`, name: 'Competent', level: 3, points: 3 },
    ],
    ...overrides,
  }
}

describe('normalizeResults', () => {
  it('returns undefined when there are no results, so old credentials serialize unchanged', () => {
    expect(normalizeResults(undefined, undefined)).toBeUndefined()
    expect(normalizeResults([], [])).toBeUndefined()
  })

  it('normalizes types and stringifies level and points', () => {
    const out = normalizeResults([description()], [{ resultDescription: base, achievedLevel: `${base}:level:3` }])
    expect(out?.resultDescription[0].type).toEqual(['ResultDescription'])
    expect(out?.resultDescription[0].rubricCriterionLevel?.[1]).toEqual({
      id: `${base}:level:3`,
      type: ['RubricCriterionLevel'],
      name: 'Competent',
      level: '3',
      points: '3',
    })
    expect(out?.result[0]).toEqual({
      type: ['Result'],
      resultDescription: base,
      achievedLevel: `${base}:level:3`,
    })
  })

  it('rejects a result pointing at an unknown description', () => {
    expect(() => normalizeResults([description()], [{ resultDescription: 'urn:other' }])).toThrow(
      /does not match any resultDescription/,
    )
  })

  it('rejects an achievedLevel that is not a level of its description', () => {
    expect(() =>
      normalizeResults([description()], [{ resultDescription: base, achievedLevel: `${base}:level:9` }]),
    ).toThrow(/is not a level of/)
  })

  it('rejects a requiredLevel outside the description', () => {
    expect(() => normalizeResults([description({ requiredLevel: 'urn:nope' })], [{ resultDescription: base }])).toThrow(
      /requiredLevel/,
    )
  })

  it('requires both halves', () => {
    expect(() => normalizeResults([description()], [])).toThrow(/requires result/)
    expect(() => normalizeResults([], [{ resultDescription: base }])).toThrow(/requires resultDescription/)
  })

  it('rejects ids that are not URIs and duplicated descriptions', () => {
    expect(() => normalizeResults([description({ id: 'C1' })], [{ resultDescription: 'C1' }])).toThrow(/must be a URI/)
    expect(() => normalizeResults([description(), description()], [{ resultDescription: base }])).toThrow(
      /duplicated/,
    )
  })
})
