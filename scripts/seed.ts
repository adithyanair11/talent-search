/**
 * Seeds the local database: the two recruiters (Auth admin API) and all candidates from data/candidates.json.
 * Companies come from supabase/seed.sql. Idempotent — safe to re-run at any time.
 *
 * Run with `npm run seed` (needs the react-server condition to import src/server/*).
 */
import './lib/env'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Database } from '../src/lib/database.types'
import { getSupabaseAdmin } from '../src/server/supabase-admin'

type CandidateInsert = Database['public']['Tables']['candidates']['Insert']

interface SourceCandidate {
  id: string
  full_name: string
  avatar_url: string
  headline: string
  current_title: string
  current_company: string
  current_company_logo_url: string
  role: string
  seniority: string
  years_experience: number
  location: { city: string; state: string; country: string }
  open_to_work: boolean
  skills: string[]
  experiences: unknown[]
  education: unknown[]
}

const RECRUITERS = [
  { email: 'recruiter@acme.test', company: 'acme' },
  { email: 'recruiter@globex.test', company: 'globex' },
] as const
const PASSWORD = 'rotto-assessment'
const BATCH_SIZE = 500

const admin = getSupabaseAdmin()

function fail(step: string, error: { message: string } | null): never {
  console.error(`✖ ${step}: ${error?.message ?? 'unknown error'}`)
  process.exit(1)
}

async function findUserId(email: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail('list users', error)
    const user = data.users.find((u) => u.email?.toLowerCase() === email)
    if (user) return user.id
    if (data.users.length < 200) return undefined
  }
}

async function seedRecruiters(): Promise<void> {
  const { data: companies, error } = await admin.from('companies').select('id, slug')
  if (error) fail('read companies', error)
  const companyId = new Map(companies.map((c) => [c.slug, c.id]))

  for (const { email, company } of RECRUITERS) {
    const id = companyId.get(company)
    if (!id) fail(`company "${company}" missing (did supabase/seed.sql run?)`, null)

    let userId = await findUserId(email)
    if (userId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      })
      if (updateError) fail(`update ${email}`, updateError)
    } else {
      const { data, error: createError } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      })
      if (createError) fail(`create ${email}`, createError)
      userId = data.user.id
    }

    const { error: linkError } = await admin
      .from('recruiters')
      .upsert({ user_id: userId, company_id: id }, { onConflict: 'user_id' })
    if (linkError) fail(`link ${email}`, linkError)
  }
}

function toRow(c: SourceCandidate): CandidateInsert {
  return {
    id: c.id,
    full_name: c.full_name,
    avatar_url: c.avatar_url,
    headline: c.headline,
    current_title: c.current_title,
    current_company: c.current_company,
    current_company_logo_url: c.current_company_logo_url,
    role: c.role,
    seniority: c.seniority,
    years_experience: c.years_experience,
    city: c.location.city,
    state: c.location.state,
    country: c.location.country,
    open_to_work: c.open_to_work,
    skills: c.skills,
    experiences: c.experiences as CandidateInsert['experiences'],
    education: c.education as CandidateInsert['education'],
  }
}

async function seedCandidates(): Promise<number> {
  const file = path.resolve(process.cwd(), 'data/candidates.json')
  const candidates = JSON.parse(readFileSync(file, 'utf8')) as SourceCandidate[]
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE).map(toRow)
    const { error } = await admin.from('candidates').upsert(batch, { onConflict: 'id' })
    if (error) fail(`upsert candidates ${i + 1}-${i + batch.length}`, error)
  }
  return candidates.length
}

async function count(table: 'companies' | 'recruiters' | 'candidates'): Promise<number> {
  const { count: n, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) fail(`count ${table}`, error)
  return n ?? 0
}

async function main(): Promise<void> {
  await seedRecruiters()
  const expected = await seedCandidates()

  const counts = {
    companies: await count('companies'),
    recruiters: await count('recruiters'),
    candidates: await count('candidates'),
  }
  console.log(
    `✔ Seeded: ${counts.companies} companies, ${counts.recruiters} recruiters, ${counts.candidates} candidates`,
  )
  if (counts.candidates !== expected || counts.recruiters < RECRUITERS.length) {
    console.error(`✖ Expected ${expected} candidates and ${RECRUITERS.length} recruiters`)
    process.exit(1)
  }
}

void main()
