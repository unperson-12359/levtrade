import { emptyOutcome, summarizeCoverage } from './_signals.mjs'
import type { SetupOutcome, SetupWindow } from '../src/types/setup'
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
    const updatedSince = resolveUpdatedSince(req.query)
    const [rows, latestSuccessfulAtMs] = await Promise.all([
      fetchServerSetupsFromSupabase(supabase, since, updatedSince),
      fetchLatestServerSetupUpdatedAt(supabase),
    ])

    const setups = rows.map((row) => {
      const outcomes = normalizeOutcomes(row.outcomes_json)
      return {
        id: row.id,
        setup: row.setup_json,
        coverageStatus: summarizeCoverage(outcomes, undefined),
        outcomes,
      }
    })
    const latestGeneratedAt = rows[0]?.generated_at ?? null

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      setups,
      count: setups.length,
      rowCount: rows.length,
      fetchedAt: new Date().toISOString(),
      latestGeneratedAt,
      truncated: rows.length >= MAX_FETCH_ROWS,
      maxRowsApplied: rows.length >= MAX_FETCH_ROWS ? MAX_FETCH_ROWS : null,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: latestSuccessfulAtMs,
        freshness: latestSuccessfulAtMs === null ? 'delayed' : undefined,
        staleAfterMs: MS_PER_DAY,
      }),
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      error: err instanceof Error ? err.message : 'Unexpected error',
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: MS_PER_DAY,
      }),
    })
  }
}

async function fetchServerSetupsFromSupabase(
  supabase: SupabaseEnv,
  since: string,
  updatedSince: string | null,
): Promise<Array<{
  id: string
  coin: string
  direction: string
  setup_json: Record<string, unknown>
  outcomes_json: Record<string, unknown> | null
  generated_at: string
  updated_at: string | null
}>> {
  const rows: Array<{
    id: string
    coin: string
    direction: string
    setup_json: Record<string, unknown>
    outcomes_json: Record<string, unknown> | null
    generated_at: string
    updated_at: string | null
  }> = []

  for (let offset = 0; offset < MAX_FETCH_ROWS; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      generated_at: `gte.${since}`,
      order: 'generated_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      select: 'id,coin,direction,setup_json,outcomes_json,generated_at,updated_at',
    })
    if (updatedSince) {
      params.set('updated_at', `gte.${updatedSince}`)
    }

    const page = await fetchSupabaseRows<{
      id: string
      coin: string
      direction: string
      setup_json: Record<string, unknown>
      outcomes_json: Record<string, unknown> | null
      generated_at: string
      updated_at: string | null
    }>({
      env: supabase,
      table: 'server_setups',
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
  const rawSince = firstQueryValue(query.since)
  const parsedSince = rawSince ? Date.parse(rawSince) : Number.NaN
  if (Number.isFinite(parsedSince)) {
    return new Date(parsedSince).toISOString()
  }

  const days = resolveDays(query)
  return new Date(Date.now() - days * MS_PER_DAY).toISOString()
}

function resolveUpdatedSince(query: VercelRequest['query']): string | null {
  const rawUpdatedSince = firstQueryValue(query.updatedSince)
  const parsedUpdatedSince = rawUpdatedSince ? Date.parse(rawUpdatedSince) : Number.NaN
  if (!Number.isFinite(parsedUpdatedSince)) {
    return null
  }

  return new Date(parsedUpdatedSince).toISOString()
}

function resolveDays(query: VercelRequest['query']): number {
  const parsedDays = parseInt(firstQueryValue(query.days) ?? '', 10)
  if (!Number.isFinite(parsedDays)) {
    return DEFAULT_DAYS
  }
  return Math.max(1, Math.min(MAX_DAYS, parsedDays))
}

async function fetchLatestServerSetupUpdatedAt(supabase: SupabaseEnv): Promise<number | null> {
  const rows = await fetchSupabaseRows<{
    generated_at: string
    updated_at: string | null
  }>({
    env: supabase,
    table: 'server_setups',
    query: new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      order: 'updated_at.desc',
      limit: '1',
      select: 'generated_at,updated_at',
    }),
  })

  const row = rows[0]
  if (!row) return null
  return Date.parse(row.updated_at ?? row.generated_at)
}

function normalizeOutcomes(raw: Record<string, unknown> | null): Record<SetupWindow, SetupOutcome> {
  return {
    '4h': normalizeOutcome(raw?.['4h'], '4h'),
    '24h': normalizeOutcome(raw?.['24h'], '24h'),
    '72h': normalizeOutcome(raw?.['72h'], '72h'),
  }
}

function normalizeOutcome(raw: unknown, window: SetupWindow): SetupOutcome {
  return {
    ...emptyOutcome(window),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
    window,
  } as SetupOutcome
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
}
