import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CITIES,
  COMPANIES,
  DEGREES,
  FIELDS_OF_STUDY,
  ROLES,
  SCHOOLS,
  SENIORITIES,
  SKILLS,
  STATES,
} from './vocabulary'

interface SourceCandidate {
  role: string
  seniority: string
  location: { city: string; state: string }
  skills: string[]
  experiences: { company: string; company_type: string }[]
  education: { degree: string; school: string; field: string }[]
}

const candidates = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../data/candidates.json'), 'utf8'),
) as SourceCandidate[]

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort()

describe('vocabulary matches data/candidates.json exactly', () => {
  it('roles, seniority', () => {
    expect(sorted(ROLES)).toEqual(sorted(candidates.map((c) => c.role)))
    expect(sorted(SENIORITIES)).toEqual(sorted(candidates.map((c) => c.seniority)))
  })

  it('cities with their states, and states', () => {
    expect(sorted(CITIES.map((c) => `${c.city}|${c.state}`))).toEqual(
      sorted(candidates.map((c) => `${c.location.city}|${c.location.state}`)),
    )
    expect(sorted(STATES)).toEqual(sorted(candidates.map((c) => c.location.state)))
  })

  it('skills', () => {
    expect(sorted(SKILLS)).toEqual(sorted(candidates.flatMap((c) => c.skills)))
    expect(SKILLS).toHaveLength(new Set(SKILLS).size)
  })

  it('companies with their type', () => {
    expect(sorted(COMPANIES.map((c) => `${c.name}|${c.type}`))).toEqual(
      sorted(candidates.flatMap((c) => c.experiences.map((e) => `${e.company}|${e.company_type}`))),
    )
  })

  it('degrees, schools, fields of study', () => {
    const edu = candidates.flatMap((c) => c.education)
    expect(sorted(DEGREES)).toEqual(sorted(edu.map((e) => e.degree)))
    expect(sorted(SCHOOLS)).toEqual(sorted(edu.map((e) => e.school)))
    expect(sorted(FIELDS_OF_STUDY)).toEqual(sorted(edu.map((e) => e.field)))
  })
})
