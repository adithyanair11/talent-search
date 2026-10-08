import 'server-only'

import { HttpError } from '@/lib/http'
import { educationSchema, experiencesSchema, type PersonResponse } from '@/lib/schemas/people'

import type { RequestContext } from '../auth'

const COLUMNS =
  'id, full_name, avatar_url, headline, current_title, current_company, current_company_logo_url, role, seniority, ' +
  'years_experience, city, state, country, open_to_work, skills, experiences, education'

/** One candidate with experience (newest first, as stored), education and skills. RLS: any authenticated recruiter. */
export async function getPerson(ctx: RequestContext, id: string): Promise<PersonResponse> {
  const { data, error } = await ctx.supabase
    .from('candidates')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle<{
      id: string
      full_name: string
      avatar_url: string
      headline: string
      current_title: string
      current_company: string
      current_company_logo_url: string
      role: string
      seniority: PersonResponse['seniority']
      years_experience: number
      city: string
      state: string
      country: string
      open_to_work: boolean
      skills: string[]
      experiences: unknown
      education: unknown
    }>()
  if (error) throw new Error(`candidate lookup failed: ${error.message}`)
  if (!data) throw new HttpError('not_found', 'Candidate not found.')

  return {
    id: data.id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    headline: data.headline,
    current_title: data.current_title,
    current_company: data.current_company,
    current_company_logo_url: data.current_company_logo_url,
    role: data.role,
    seniority: data.seniority,
    years_experience: data.years_experience,
    location: { city: data.city, state: data.state, country: data.country },
    open_to_work: data.open_to_work,
    skills: data.skills,
    experiences: experiencesSchema.parse(data.experiences),
    education: educationSchema.parse(data.education),
  }
}
