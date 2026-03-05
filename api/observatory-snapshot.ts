import { buildContractMeta, CONTRACT_VERSION_V1 } from './_contracts.js'
import { buildObservatorySnapshot } from '../src/observatory/engine'
import { TRACKED_COINS, parseCandle, type FundingHistoryEntry, type RawCandle, type TrackedCoin } from '../src/types/market'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

type Interval = '1h' | '4h' | '1d'

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info'
const CACHE_TTL_MS = 60_000
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000

const cache = new Map<string, { expiresAt: number; payload: unknown }>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const coin = resolveCoin(req.query.coin)
  const interval = resolveInterval(req.query.interval)
  const key = `${coin}:${interval}`
  const now = Date.now()

  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(cached.payload)
  }

  try {
    const [rawCandles, fundingHistory, mids] = await Promise.all([
      fetchCandles(coin, interval, now - LOOKBACK_MS, now),
      fetchFundingHistory(coin, now - LOOKBACK_MS, now),
      fetchAllMids(),
    ])

    const candles = rawCandles.map(parseCandle).sort((a, b) => a.time - b.time)
    const funding = fundingHistory
      .map((entry) => ({ time: entry.time, rate: parseFloat(entry.fundingRate) }))
      .filter((entry) => Number.isFinite(entry.rate))

    const snapshot = buildObservatorySnapshot({
      coin,
      interval,
      candles,
      fundingHistory: funding,
      oiHistory: [],
    })

    const priceContext = buildPriceContext(candles, interval, mids[coin])
    const generatedAt = Date.now()
    const payload = {
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      coin,
      interval,
      snapshot: stripRawValues(snapshot),
      priceContext,
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

function buildPriceContext(
  candles: Array<{ time: number; close: number }>,
  interval: Interval,
  midPriceRaw: string | undefined,
) {
  const latestClose = candles[candles.length - 1]?.close ?? null
  const midPrice = typeof midPriceRaw === 'string' ? parseFloat(midPriceRaw) : Number.NaN
  const lastPrice = Number.isFinite(midPrice) ? midPrice : latestClose

  const barsFor24h = interval === '1h' ? 24 : interval === '4h' ? 6 : 1
  const barsForIntervalReturn = 1
  const close24hAgo = candles[Math.max(0, candles.length - 1 - barsFor24h)]?.close ?? null
  const closePrevious = candles[Math.max(0, candles.length - 1 - barsForIntervalReturn)]?.close ?? null

  const change24hPct =
    lastPrice && close24hAgo && close24hAgo !== 0 ? ((lastPrice - close24hAgo) / Math.abs(close24hAgo)) * 100 : null
  const intervalReturnPct =
    lastPrice && closePrevious && closePrevious !== 0 ? ((lastPrice - closePrevious) / Math.abs(closePrevious)) * 100 : null

  return {
    lastPrice,
    change24hPct,
    intervalReturnPct,
    updatedAt: new Date().toISOString(),
  }
}

async function fetchAllMids(): Promise<Record<string, string>> {
  return postInfo<Record<string, string>>({ type: 'allMids' })
}

async function fetchCandles(
  coin: TrackedCoin,
  interval: Interval,
  startTime: number,
  endTime: number,
): Promise<RawCandle[]> {
  return postInfo<RawCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime, endTime },
  })
}

async function fetchFundingHistory(coin: TrackedCoin, startTime: number, endTime: number): Promise<FundingHistoryEntry[]> {
  return postInfo<FundingHistoryEntry[]>({
    type: 'fundingHistory',
    coin,
    startTime,
    endTime,
  })
}

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Hyperliquid request failed: ${response.status}`)
    }
    return response.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

function resolveCoin(raw: string | string[] | undefined): TrackedCoin {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && TRACKED_COINS.includes(value as TrackedCoin)) {
    return value as TrackedCoin
  }
  return 'BTC'
}

function resolveInterval(raw: string | string[] | undefined): Interval {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === '1h' || value === '4h' || value === '1d') return value
  return '1h'
}
