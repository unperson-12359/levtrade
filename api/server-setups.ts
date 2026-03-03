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
const MAX_FETCH_LIMIT = 2_000
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
    const params = new URLSearchParams({
      scope: `eq.${GLOBAL_SCOPE}`,
      generated_at: `gte.${since}`,
      order: 'generated_at.desc',
      limit: String(MAX_FETCH_LIMIT),
      select: 'id,coin,direction,setup_json,outcomes_json,generated_at,updated_at',
    })

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/server_setups?${params.toString()}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const rows = (await response.json()) as Array<{
      id: string
      coin: string
      direction: string
      setup_json: Record<string, unknown>
      outcomes_json: Record<string, unknown> | null
      generated_at: string
    }>

    const setups = rows.map((row) => ({
      id: row.id,
      setup: row.setup_json,
      coverageStatus: 'full',
      outcomes: row.outcomes_json ?? {
        '4h': emptyOutcome('4h'),
        '24h': emptyOutcome('24h'),
        '72h': emptyOutcome('72h'),
      },
    }))

    return res.status(200).json({ ok: true, setups, count: setups.length })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
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

function emptyOutcome(window: string) {
  return {
    window,
    resolvedAt: null,
    result: 'pending',
    resolutionReason: 'pending',
    coverageStatus: 'full',
    candleCountUsed: 0,
    returnPct: null,
    rAchieved: null,
    mfe: null,
    mfePct: null,
    mae: null,
    maePct: null,
    targetHit: false,
    stopHit: false,
    priceAtResolution: null,
  }
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
}
