import { emptyOutcome } from './_signals.mjs'
import type { SetupWindow } from '../src/types/setup'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

interface IncomingSetup {
  id: string
  setup: {
    coin: string
    direction: string
    entryPrice: number
    stopPrice: number
    targetPrice: number
    generatedAt: number
    [key: string]: unknown
  }
  outcomes?: Record<string, unknown>
}

const GLOBAL_SCOPE = 'global'
const MAX_BATCH_SIZE = 100

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: 'Not configured' })
  }

  try {
    const body = req.body as { setups?: IncomingSetup[] } | undefined
    const setups = body?.setups

    if (!Array.isArray(setups) || setups.length === 0) {
      return res.status(400).json({ ok: false, error: 'No setups provided' })
    }

    if (setups.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ ok: false, error: `Max ${MAX_BATCH_SIZE} setups per request` })
    }

    const valid = setups.filter(
      (s) => s.id && s.setup?.coin && s.setup?.direction && s.setup?.entryPrice && s.setup?.generatedAt,
    )

    if (valid.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid setups in payload' })
    }

    const rows = valid.map((s) => ({
      id: s.id,
      scope: GLOBAL_SCOPE,
      coin: s.setup.coin,
      direction: s.setup.direction,
      setup_json: s.setup,
      outcomes_json: s.outcomes ?? {
        '4h': emptyOutcome('4h' as SetupWindow),
        '24h': emptyOutcome('24h' as SetupWindow),
        '72h': emptyOutcome('72h' as SetupWindow),
      },
      generated_at: new Date(s.setup.generatedAt).toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/server_setups`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(500).json({ ok: false, error: `Supabase insert failed: ${response.status}`, detail: text })
    }

    const inserted = (await response.json()) as unknown[]
    const synced = inserted.length
    const skipped = valid.length - synced

    return res.status(200).json({ ok: true, synced, skipped, total: valid.length })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}
