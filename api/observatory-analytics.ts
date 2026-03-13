import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts.js'
import { OBSERVATORY_RULESET_VERSION } from './_signals.mjs'
import { loadPersistedObservatoryAnalytics } from './_observatoryAnalytics.js'
import {
  parsePositiveInteger,
  parseCoinParam,
  parseObservatoryIntervalParam,
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

  const coin = parseCoinParam(req.query.coin)
  if (!coin.ok) {
    return res.status(400).json({ ok: false, error: coin.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  const interval = resolveInterval(req.query.interval)
  if (!interval.ok) {
    return res.status(400).json({ ok: false, error: interval.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  const days = parsePositiveInteger(req.query.days, DEFAULT_DAYS, { min: 7, max: MAX_DAYS })

  try {
    const analytics = await loadPersistedObservatoryAnalytics({ coin: coin.value, interval: interval.value, days })
    // Two-tier caching: CDN serves cached responses for 5min (s-maxage=300) while
    // the client-side staleAfterMs (12-48h) controls when the UI re-fetches fresh analytics.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      coin: coin.value,
      interval: interval.value,
      days,
      analytics,
      rulesetVersion: OBSERVATORY_RULESET_VERSION,
      meta: buildContractMeta({
        source: 'ledger',
        lastSuccessfulAtMs: analytics.lastPersistedBarTime,
        staleAfterMs: 48 * 60 * 60 * 1000,
      }),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      coin: coin.value,
      interval: interval.value,
      days,
      error: error instanceof Error ? error.message : 'Unexpected error',
      rulesetVersion: OBSERVATORY_RULESET_VERSION,
      meta: buildContractMeta({
        source: 'ledger',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: 48 * 60 * 60 * 1000,
      }),
    })
  }
}

function resolveInterval(raw: string | string[] | undefined) {
  return parseObservatoryIntervalParam(raw)
}
