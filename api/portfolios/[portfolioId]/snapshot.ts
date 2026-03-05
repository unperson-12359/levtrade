import type { LivePerformanceSnapshotV1 } from '../../../src/contracts/v1'
import { buildContractMeta, CONTRACT_VERSION_V1 } from '../../_contracts.js'
import { fetchSupabaseRows, getSupabaseEnv, type SupabaseEnv } from '../../_supabase.js'
import {
  normalizeCanonicalSetups,
  summarizeWindowStats,
  type CanonicalSetupRow,
} from '../../_analytics.js'

interface VercelRequest {
  method?: string
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
const COLLECTOR_NAME = 'primary'

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
    const portfolioId = firstQueryValue(req.query.portfolioId) ?? 'global'
    const windowDays = resolveDays(req.query)
    const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()
    const rows = await fetchSetupRows(supabase, since)
    const normalized = normalizeCanonicalSetups(rows)
    const stats24h = summarizeWindowStats(normalized, '24h')
    const latestSetupAt = rows[0]?.generated_at ?? null
    const latestCollectorRunAt = await fetchLatestCollectorRun(supabase)
    const latestSetupMs = latestSetupAt ? Date.parse(latestSetupAt) : null
    const latestCollectorMs = latestCollectorRunAt ? Date.parse(latestCollectorRunAt) : null
    const lastSuccessfulAtMs = maxNullable(latestSetupMs, latestCollectorMs)
    const snapshot: LivePerformanceSnapshotV1 = {
      portfolioId,
      windowDays,
      setupCount: normalized.length,
      resolvedCount24h: stats24h.wins + stats24h.losses + stats24h.expired,
      pendingCount24h: stats24h.pending,
      winRate24h: stats24h.winRate,
      avgR24h: stats24h.avgR,
      latestSetupAt,
      latestCollectorRunAt,
      canonicalReady: normalized.length > 0,
      generatedAt: new Date().toISOString(),
    }

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      snapshot,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs,
        freshness: normalized.length === 0 ? 'delayed' : undefined,
        staleAfterMs: MS_PER_DAY,
      }),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
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

async function fetchSetupRows(supabase: SupabaseEnv, since: string): Promise<CanonicalSetupRow[]> {
  const rows: CanonicalSetupRow[] = []

  for (let offset = 0; offset < MAX_FETCH_ROWS; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      generated_at: `gte.${since}`,
      order: 'generated_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      select: 'id,setup_json,outcomes_json,generated_at,updated_at',
    })
    const page = await fetchSupabaseRows<CanonicalSetupRow>({
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

async function fetchLatestCollectorRun(supabase: SupabaseEnv): Promise<string | null> {
  const params = new URLSearchParams({
    collector_name: `eq.${COLLECTOR_NAME}`,
    limit: '1',
    select: 'last_run_at',
  })
  const rows = await fetchSupabaseRows<{ last_run_at: string | null }>({
    env: supabase,
    table: 'collector_heartbeat',
    query: params,
  })
  return rows[0]?.last_run_at ?? null
}

function resolveDays(query: VercelRequest['query']): number {
  const rawDays = firstQueryValue(query.days)
  return Math.min(MAX_DAYS, parseInt(rawDays ?? '', 10) || DEFAULT_DAYS)
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(a as number, b as number)
  if (Number.isFinite(a)) return a as number
  if (Number.isFinite(b)) return b as number
  return null
}
