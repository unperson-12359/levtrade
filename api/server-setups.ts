import { emptyOutcome, summarizeCoverage } from './_signals.mjs'
import type { SetupOutcome, SetupWindow } from '../src/types/setup'

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
    const updatedSince = resolveUpdatedSince(req.query)
    const rows = await fetchServerSetupsFromSupabase(since, updatedSince)

    const setups = rows.map((row) => {
      const outcomes = normalizeOutcomes(row.outcomes_json)
      return {
        id: row.id,
        setup: row.setup_json,
        coverageStatus: summarizeCoverage(outcomes, undefined),
        outcomes,
      }
    })

    return res.status(200).json({
      ok: true,
      setups,
      count: setups.length,
      rowCount: rows.length,
      fetchedAt: new Date().toISOString(),
      truncated: rows.length >= MAX_FETCH_ROWS,
      maxRowsApplied: rows.length >= MAX_FETCH_ROWS ? MAX_FETCH_ROWS : null,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

async function fetchServerSetupsFromSupabase(since: string, updatedSince: string | null): Promise<Array<{
  id: string
  coin: string
  direction: string
  setup_json: Record<string, unknown>
  outcomes_json: Record<string, unknown> | null
  generated_at: string
}>> {
  const rows: Array<{
    id: string
    coin: string
    direction: string
    setup_json: Record<string, unknown>
    outcomes_json: Record<string, unknown> | null
    generated_at: string
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

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/server_setups?${params.toString()}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const page = (await response.json()) as Array<{
      id: string
      coin: string
      direction: string
      setup_json: Record<string, unknown>
      outcomes_json: Record<string, unknown> | null
      generated_at: string
    }>

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

  const days = Math.min(MAX_DAYS, parseInt(firstQueryValue(query.days) ?? '', 10) || DEFAULT_DAYS)
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
