import { computeTrackerStats } from './_signals.mjs'
import type { TrackedSignalRecord, TrackedSignalOutcome, TrackerWindow } from '../src/types/tracker'
import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts.js'
import { fetchSupabaseRows, getSupabaseEnv, type SupabaseEnv } from './_supabase.js'

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
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const supabase = getSupabaseEnv()
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'Not configured',
      contractVersion: CONTRACT_VERSION_V1,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: MS_PER_DAY,
      }),
    })
  }

  try {
    const since = resolveSince(req.query)
    const rows = await fetchTrackedSignals(supabase, since)

    const records: TrackedSignalRecord[] = rows.map((row) => row.signal_json)
    const outcomes: TrackedSignalOutcome[] = rows.flatMap((row) => Object.values(row.outcomes_json))
    const stats = computeTrackerStats(records, outcomes)
    const latestUpdatedAtMs = rows.length > 0
      ? Math.max(...rows.map((row) => Date.parse(row.updated_at ?? row.recorded_at)))
      : null

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      stats,
      recordCount: rows.length,
      windowDays: resolveDays(req.query),
      computedAt: new Date().toISOString(),
      truncated: rows.length >= MAX_FETCH_ROWS,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: latestUpdatedAtMs,
        freshness: rows.length === 0 ? 'delayed' : undefined,
        staleAfterMs: MS_PER_DAY,
      }),
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
      contractVersion: CONTRACT_VERSION_V1,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: MS_PER_DAY,
      }),
    })
  }
}

async function fetchTrackedSignals(
  supabase: SupabaseEnv,
  since: string,
): Promise<Array<{
  id: string
  signal_json: TrackedSignalRecord
  outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
  recorded_at: string
  updated_at: string | null
}>> {
  const rows: Array<{
    id: string
    signal_json: TrackedSignalRecord
    outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
    recorded_at: string
    updated_at: string | null
  }> = []

  for (let offset = 0; offset < MAX_FETCH_ROWS; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      recorded_at: `gte.${since}`,
      order: 'recorded_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      select: 'id,signal_json,outcomes_json,recorded_at,updated_at',
    })

    const page = await fetchSupabaseRows<{
      id: string
      signal_json: TrackedSignalRecord
      outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
      recorded_at: string
      updated_at: string | null
    }>({
      env: supabase,
      table: 'tracked_signals',
      query: params,
    })

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
