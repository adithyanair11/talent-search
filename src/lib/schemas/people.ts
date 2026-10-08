/** Contract for `GET /api/people/{id}` (CLAUDE.md). */
import { z } from 'zod'

import type { CandidateDetail } from '@/lib/candidate'

/** Candidate ids are `cand_<digits>` (enforced by a check constraint); anything else can't exist. */
export const personIdSchema = z.string().max(32).regex(/^cand_[0-9]+$/)

/** The `experiences` / `education` jsonb columns, validated before they reach the response. */
export const experiencesSchema = z.array(
  z.object({
    title: z.string(),
    company: z.string(),
    company_logo_url: z.string().nullable(),
    company_type: z.string(),
    start_year: z.number().int(),
    end_year: z.number().int().nullable(),
    description: z.string().optional(),
  }),
)

export const educationSchema = z.array(
  z.object({
    school: z.string(),
    degree: z.string(),
    field: z.string(),
    graduation_year: z.number().int(),
  }),
)

export type PersonResponse = CandidateDetail
