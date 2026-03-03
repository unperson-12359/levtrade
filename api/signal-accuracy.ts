import { computeTrackerStats } from './_signals.mjs'
import type { TrackedSignalRecord, TrackedSignalOutcome, TrackerWindow } from '../src/types/tracker'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const DEFAULT_DAYS = 90
const MAX_DAYS = 90
const PAGE_SIZE = 1_000
const MAX_FETCH_ROWS = 100_000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const GLOBAL_SCOPE = 'global'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: 'Not configured' })
  }

  try {
    const since = resolveSince(req.query)
    const rows = await fetchTrackedSignals(since)

    const records: TrackedSignalRecord[] = rows.map((r) => r.signal_json)
    const outcomes: TrackedSignalOutcome[] = rows.flatMap((r) =>
      Object.values(r.outcomes_json),
    )

    const stats = computeTrackerStats(records, outcomes)

    return res.status(200).json({
      ok: true,
      stats,
      recordCount: rows.length,
      windowDays: resolveDays(req.query),
      computedAt: new Date().toISOString(),
      truncated: rows.length >= MAX_FETCH_ROWS,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

async function fetchTrackedSignals(since: string): Promise<Array<{
  id: string
  signal_json: TrackedSignalRecord
  outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
}>> {
  const rows: Array<{
    id: string
    signal_json: TrackedSignalRecord
    outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
  }> = []

  for (let offset = 0; offset < MAX_FETCH_ROWS; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      recorded_at: `gte.${since}`,
      order: 'recorded_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      select: 'id,signal_json,outcomes_json',
    })

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tracked_signals?${params.toString()}`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const page = (await response.json()) as Array<{
      id: string
      signal_json: TrackedSignalRecord
      outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
    }>

    rows.push(...page)
    if (page.length < PAGE_SIZE) {
      break
    }
  }

  return rows
}

function resolveSince(query: VercelRequest['query']): string {
  const days = resolveDays(query)
  return new Date(Date.now() - days * MS_PER_DAY).toISOString()
}

function resolveDays(query: VercelRequest['query']): number {
  const rawDays = firstQueryValue(query.days)
  return Math.min(MAX_DAYS, parseInt(rawDays ?? '', 10) || DEFAULT_DAYS)
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}
