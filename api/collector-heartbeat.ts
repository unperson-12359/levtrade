import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts'
import { fetchSupabaseRows, getSupabaseEnv } from './_supabase'

interface VercelRequest {
  method?: string
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const COLLECTOR_NAME = 'primary'
const LIVE_THRESHOLD_MS = 15 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const supabase = getSupabaseEnv()
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'Not configured',
      contractVersion: CONTRACT_VERSION_V1,
      meta: buildContractMeta({
        source: 'collector',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: LIVE_THRESHOLD_MS,
      }),
    })
  }

  try {
    const params = new URLSearchParams({
      collector_name: `eq.${COLLECTOR_NAME}`,
      limit: '1',
      select: 'collector_name,last_run_at,last_success_at,last_error,updated_at',
    })

    const rows = await fetchSupabaseRows<{
      collector_name: string
      last_run_at: string | null
      last_success_at: string | null
      last_error: string | null
      updated_at: string | null
    }>({
      env: supabase,
      table: 'collector_heartbeat',
      query: params,
    })

    const row = rows[0]
    if (!row) {
      return res.status(200).json({
        ok: true,
        contractVersion: CONTRACT_VERSION_V1,
        heartbeat: null,
        meta: buildContractMeta({
          source: 'collector',
          lastSuccessfulAtMs: null,
          freshness: 'error',
          staleAfterMs: LIVE_THRESHOLD_MS,
        }),
      })
    }

    const lastRunAt = row.last_run_at ? Date.parse(row.last_run_at) : null
    const lastSuccessAt = row.last_success_at ? Date.parse(row.last_success_at) : null
    const now = Date.now()
    const status =
      row.last_error && (!lastSuccessAt || now - lastSuccessAt > LIVE_THRESHOLD_MS)
        ? 'error'
        : lastRunAt && now - lastRunAt <= LIVE_THRESHOLD_MS
          ? 'live'
          : 'stale'

    const freshness = status === 'live' ? 'fresh' : status === 'stale' ? 'stale' : 'error'

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      heartbeat: {
        collectorName: row.collector_name,
        lastRunAt,
        lastSuccessAt,
        lastError: row.last_error,
        updatedAt: row.updated_at ? Date.parse(row.updated_at) : null,
        status,
      },
      meta: buildContractMeta({
        source: 'collector',
        lastSuccessfulAtMs: lastSuccessAt ?? lastRunAt,
        freshness,
        staleAfterMs: LIVE_THRESHOLD_MS,
        nowMs: now,
      }),
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      error: err instanceof Error ? err.message : 'Unexpected error',
      meta: buildContractMeta({
        source: 'collector',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: LIVE_THRESHOLD_MS,
      }),
    })
  }
}
