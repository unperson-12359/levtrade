import type { BacktestResultV1 } from '../../../src/contracts/v1'
import { buildContractMeta, CONTRACT_VERSION_V1 } from '../../_contracts'
import { fetchSupabaseRows, getSupabaseEnv, type SupabaseEnv } from '../../_supabase'
import {
  normalizeCanonicalSetups,
  summarizeWindowStats,
  type CanonicalSetupRow,
} from '../../_analytics'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
      contractVersion: CONTRACT_VERSION_V1,
    })
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
    const strategyId = firstQueryValue(req.query.strategyId) ?? 'mean-reversion-core'
    const windowDays = resolveDays(req.query)
    const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()
    const rows = await fetchSetupRows(supabase, since)
    const normalized = normalizeCanonicalSetups(rows)
    const result: BacktestResultV1 = {
      strategyId,
      windowDays,
      generatedAt: new Date().toISOString(),
      windows: {
        '4h': summarizeWindowStats(normalized, '4h'),
        '24h': summarizeWindowStats(normalized, '24h'),
        '72h': summarizeWindowStats(normalized, '72h'),
      },
    }

    const latestUpdatedAtMs = normalized.length > 0
      ? Math.max(...normalized.map((item) => item.updatedAtMs))
      : null

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      result,
      replayFingerprint: computeReplayFingerprint(normalized),
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: latestUpdatedAtMs,
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
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function resolveDays(query: VercelRequest['query']): number {
  const rawDays = firstQueryValue(query.days)
  return Math.min(MAX_DAYS, parseInt(rawDays ?? '', 10) || DEFAULT_DAYS)
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}

function computeReplayFingerprint(setups: ReturnType<typeof normalizeCanonicalSetups>): string {
  let hash = 5381
  const stable = setups
    .map((setup) => `${setup.id}:${setup.updatedAtMs}:${setup.outcomes['24h'].result}:${setup.outcomes['24h'].rAchieved ?? 'na'}`)
    .sort()
    .join('|')

  for (let i = 0; i < stable.length; i += 1) {
    hash = ((hash << 5) + hash) + stable.charCodeAt(i)
    hash |= 0
  }

  return `fp_${Math.abs(hash).toString(36)}`
}
