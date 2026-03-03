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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: 'Not configured' })
  }

  try {
    const params = new URLSearchParams({
      collector_name: `eq.${COLLECTOR_NAME}`,
      limit: '1',
      select: 'collector_name,last_run_at,last_success_at,last_error,updated_at',
    })

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/collector_heartbeat?${params.toString()}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const rows = (await response.json()) as Array<{
      collector_name: string
      last_run_at: string | null
      last_success_at: string | null
      last_error: string | null
      updated_at: string | null
    }>

    const row = rows[0]
    if (!row) {
      return res.status(200).json({ ok: true, heartbeat: null })
    }

    const lastRunAt = row.last_run_at ? Date.parse(row.last_run_at) : null
    const lastSuccessAt = row.last_success_at ? Date.parse(row.last_success_at) : null
    const status =
      row.last_error && (!lastSuccessAt || Date.now() - lastSuccessAt > LIVE_THRESHOLD_MS)
        ? 'error'
        : lastRunAt && Date.now() - lastRunAt <= LIVE_THRESHOLD_MS
          ? 'live'
          : 'stale'

    return res.status(200).json({
      ok: true,
      heartbeat: {
        collectorName: row.collector_name,
        lastRunAt,
        lastSuccessAt,
        lastError: row.last_error,
        updatedAt: row.updated_at ? Date.parse(row.updated_at) : null,
        status,
      },
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}
