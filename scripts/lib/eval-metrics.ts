/** Accuracy metrics for `npm run eval`. Pure. */

export const PAGE_SIZE = 20

export interface QueryScore {
  precision: number
  recall: number
  f1: number
  /** Share of page 1 (first 20 results) that is expected. */
  page1Precision: number
}

/**
 * Scores ranked result ids against the expected set. An empty expected set means "nothing should match":
 * returning nothing scores 1.0 everywhere, returning anyone scores 0.
 */
export function scoreQuery(resultIds: readonly string[], expectedIds: readonly string[]): QueryScore {
  const expected = new Set(expectedIds)
  const results = [...new Set(resultIds)]
  if (expected.size === 0) {
    const s = results.length === 0 ? 1 : 0
    return { precision: s, recall: s, f1: s, page1Precision: s }
  }
  const hits = results.filter((id) => expected.has(id)).length
  const precision = results.length === 0 ? 0 : hits / results.length
  const recall = hits / expected.size
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  const page1 = results.slice(0, PAGE_SIZE)
  const page1Precision = page1.length === 0 ? 0 : page1.filter((id) => expected.has(id)).length / page1.length
  return { precision, recall, f1, page1Precision }
}

export function macroAverage(scores: readonly QueryScore[]): QueryScore {
  const avg = (k: keyof QueryScore) =>
    scores.length === 0 ? 0 : scores.reduce((sum, s) => sum + s[k], 0) / scores.length
  return { precision: avg('precision'), recall: avg('recall'), f1: avg('f1'), page1Precision: avg('page1Precision') }
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}
