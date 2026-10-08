import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { checkShortlistName, isUuid } from '@/lib/limits'
import { shortlistNameSchema } from '@/lib/schemas/shortlists'

// The browser uses these zod-free checks; the API uses the schemas. They must agree.

describe('isUuid', () => {
  const samples = [
    '0b5c6f0e-2f7a-4c1e-9b8a-3d2e1f0a9b8c',
    '0B5C6F0E-2F7A-4C1E-9B8A-3D2E1F0A9B8C',
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '0b5c6f0e-2f7a-9c1e-9b8a-3d2e1f0a9b8c', // version 9
    '0b5c6f0e-2f7a-4c1e-7b8a-3d2e1f0a9b8c', // bad variant
    '0b5c6f0e2f7a4c1e9b8a3d2e1f0a9b8c',
    ' 0b5c6f0e-2f7a-4c1e-9b8a-3d2e1f0a9b8c',
    '0b5c6f0e-2f7a-4c1e-9b8a-3d2e1f0a9b8c\n',
    'not-a-uuid',
    '',
  ]
  it.each(samples)('matches z.uuid() for %j', (s) => {
    expect(isUuid(s)).toBe(z.uuid().safeParse(s).success)
  })
})

describe('checkShortlistName', () => {
  it.each(['Frontend', '  Padded  ', '', '   ', 'x'.repeat(60), 'x'.repeat(61), ` ${'x'.repeat(60)} `])(
    'matches shortlistNameSchema for %j',
    (raw) => {
      const schema = shortlistNameSchema.safeParse(raw)
      const checked = checkShortlistName(raw)
      if (schema.success) expect(checked).toEqual({ name: schema.data })
      else expect(checked).toEqual({ error: schema.error.issues[0]?.message })
    },
  )
})
