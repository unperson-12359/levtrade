import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts.js'
import { OBSERVATORY_RULESET_VERSION, buildObservatorySnapshot, buildPriceContext, parseCandle } from './_signals.mjs'
import {
  fetchAllMids,
  fetchCandles,
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

const CACHE_TTL_MS = 60_000
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000

const cache = new Map<string, { expiresAt: number; payload: unknown }>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const coin = parseCoinParam(req.query.coin)
  if (!coin.ok) {
    return res.status(400).json({ ok: false, error: coin.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  const interval = parseObservatoryIntervalParam(req.query.interval)
  if (!interval.ok) {
    return res.status(400).json({ ok: false, error: interval.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  const key = `${coin.value}:${interval.value}`
  const now = Date.now()

  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(cached.payload)
  }

  try {
    const [rawCandles, mids] = await Promise.all([
      fetchCandles(coin.value, interval.value, now - LOOKBACK_MS, now),
      fetchAllMids(),
    ])

    const candles = rawCandles.map(parseCandle).sort((a, b) => a.time - b.time)

    const snapshot = buildObservatorySnapshot({
      coin: coin.value,
      interval: interval.value,
      candles,
    })

    const generatedAt = Date.now()
    const midPriceRaw = mids[coin.value]
    const priceContext = buildPriceContext({
      candles,
      interval: interval.value,
      livePrice: typeof midPriceRaw === 'string' ? parseFloat(midPriceRaw) : null,
      livePriceObservedAtMs: typeof midPriceRaw === 'string' ? generatedAt : null,
      generatedAtMs: generatedAt,
    })
    const payload = {
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      coin: coin.value,
      interval: interval.value,
      snapshot: stripRawValues(snapshot),
      priceContext,
      rulesetVersion: OBSERVATORY_RULESET_VERSION,
      meta: buildContractMeta({
        source: 'derived',
        lastSuccessfulAtMs: generatedAt,
        staleAfterMs: CACHE_TTL_MS,
      }),
    }

    cache.set(key, { expiresAt: generatedAt + CACHE_TTL_MS, payload })
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(payload)
  } catch (error) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      error: error instanceof Error ? error.message : 'Unexpected error',
      rulesetVersion: OBSERVATORY_RULESET_VERSION,
      meta: buildContractMeta({
        source: 'derived',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: CACHE_TTL_MS,
      }),
    })
  }
}

function stripRawValues(snapshot: ReturnType<typeof buildObservatorySnapshot>) {
  return {
    ...snapshot,
    indicators: snapshot.indicators.map((indicator) => ({
      ...indicator,
      rawValues: undefined,
    })),
  }
}
