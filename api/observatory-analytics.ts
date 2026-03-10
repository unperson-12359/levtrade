import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts.js'
import { loadPersistedObservatoryAnalytics } from './_observatoryAnalytics.js'
import {
  parsePositiveInteger,
  resolveCoin,
  resolveObservatoryInterval,
  type ObservatoryInterval,
} from './_hyperliquid.js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const DEFAULT_DAYS = 180
const MAX_DAYS = 365

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const coin = resolveCoin(req.query.coin)
  const interval = resolveInterval(req.query.interval)
  const days = parsePositiveInteger(req.query.days, DEFAULT_DAYS, { min: 7, max: MAX_DAYS })

  try {
    const analytics = await loadPersistedObservatoryAnalytics({ coin, interval, days })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      coin,
      interval,
      days,
      analytics,
      meta: buildContractMeta({
        source: 'derived',
        lastSuccessfulAtMs: analytics.lastPersistedBarTime,
        staleAfterMs: interval === '4h' ? 12 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000,
      }),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      coin,
      interval,
      days,
      error: error instanceof Error ? error.message : 'Unexpected error',
      meta: buildContractMeta({
        source: 'derived',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: interval === '4h' ? 12 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000,
      }),
    })
  }
}

function resolveInterval(raw: string | string[] | undefined): ObservatoryInterval {
  return resolveObservatoryInterval(raw)
}
