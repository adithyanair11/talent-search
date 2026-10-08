/**
 * TEMPORARY matcher for `npm run eval` until `public.run_search` exists — delete it then.
 *
 * Applies canonical filters to `public.candidates` through PostgREST with the admin client (candidates are
 * shared across companies, so RLS adds nothing here). Every value has already passed `filtersSchema`, i.e.
 * it is an exact vocabulary value. Order is by id only: a placeholder until the real SQL ranking lands.
 */
import { isSearchable, type Filters } from '../../src/lib/schemas/filters'
import { getSupabaseAdmin } from '../../src/server/supabase-admin'

const BATCH = 1000

const lower = (xs: readonly string[]) => xs.map((x) => x.toLowerCase())
/** PostgREST filter-string literal; values are vocabulary strings, quoted so spaces/commas are safe. */
const quote = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`

export async function tempSearch(filters: Filters): Promise<string[]> {
  if (!isSearchable(filters)) return []
  const admin = getSupabaseAdmin()
  const ids: string[] = []

  for (let from = 0; ; from += BATCH) {
    let q = admin.from('candidates').select('id')
    if (filters.roles) q = q.in('role', filters.roles)
    if (filters.seniority) q = q.in('seniority', filters.seniority)
    if (filters.years_experience?.min !== undefined) q = q.gte('years_experience', filters.years_experience.min)
    if (filters.years_experience?.max !== undefined) q = q.lte('years_experience', filters.years_experience.max)
    if (filters.locations) {
      q = q.or(
        filters.locations
          .map((l) => ('city' in l ? `city_key.eq.${quote(l.city.toLowerCase())}` : `state_key.eq.${l.state}`))
          .join(','),
      )
    }
    if (filters.open_to_work !== undefined) q = q.eq('open_to_work', filters.open_to_work)
    if (filters.skills_all) q = q.contains('skills_key', lower(filters.skills_all))
    if (filters.skills_any) q = q.overlaps('skills_key', lower(filters.skills_any))
    if (filters.companies) {
      q =
        filters.companies.scope === 'current'
          ? q.in('current_company', filters.companies.names)
          : q.overlaps('companies_key', lower(filters.companies.names))
    }
    if (filters.company_type) {
      q =
        filters.company_type.scope === 'current'
          ? q.eq('current_company_type', filters.company_type.value)
          : q.contains('company_types', [filters.company_type.value])
    }
    if (filters.degrees) q = q.overlaps('degrees', filters.degrees)
    if (filters.schools) q = q.overlaps('schools_key', lower(filters.schools))
    if (filters.fields_of_study) q = q.overlaps('fields_key', lower(filters.fields_of_study))

    const { data, error } = await q.order('id').range(from, from + BATCH - 1)
    if (error) throw new Error(`temp search failed: ${error.message}`)
    ids.push(...data.map((r) => r.id))
    if (data.length < BATCH) return ids
  }
}
