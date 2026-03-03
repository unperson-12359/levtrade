import type { RawCandle, AssetContext, MetaResponse, FundingHistoryEntry, TrackedCoin } from '../types/market'

const API_URL = 'https://api.hyperliquid.xyz/info'

// Binance perpetual symbol mapping — HYPE is not listed on Binance
const BINANCE_SYMBOL_MAP: Record<TrackedCoin, string | null> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  HYPE: null,
}

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** Fetch mid prices for all assets. Returns { "BTC": "95000.50", ... } */
export async function fetchAllMids(): Promise<Record<string, string>> {
  return postInfo<Record<string, string>>({ type: 'allMids' })
}

/** Fetch meta + asset contexts. Returns [meta, assetCtx[]] */
export async function fetchMetaAndAssetCtxs(): Promise<[MetaResponse, AssetContext[]]> {
  const raw = await postInfo<[MetaResponse, AssetContext[]]>({ type: 'metaAndAssetCtxs' })
  return raw
}

/** Fetch candle data for a coin. Max 5000 candles per request. */
export async function fetchCandles(
  coin: string,
  interval: string,
  startTime: number,
  endTime?: number,
): Promise<RawCandle[]> {
  const req: Record<string, unknown> = { coin, interval, startTime }
  if (endTime !== undefined) req.endTime = endTime
  return postInfo<RawCandle[]>({ type: 'candleSnapshot', req })
}

/** Fetch funding rate history for a coin */
export async function fetchFundingHistory(
  coin: string,
  startTime: number,
  endTime?: number,
): Promise<FundingHistoryEntry[]> {
  const body: Record<string, unknown> = { type: 'fundingHistory', coin, startTime }
  if (endTime !== undefined) body.endTime = endTime
  return postInfo<FundingHistoryEntry[]>(body)
}

// ── External Context APIs ──────────────────────────────────────────────

/** Fetch Fear & Greed Index from alternative.me */
export async function fetchFearGreed(): Promise<{
  value: number
  classification: string
  timestamp: number
}> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1')
  if (!res.ok) throw new Error(`Fear & Greed API error: ${res.status}`)
  const json = (await res.json()) as { data?: Array<{ value: string; value_classification: string; timestamp: string }> }
  const entry = json.data?.[0]
  if (!entry) throw new Error('Fear & Greed API returned no data')
  return {
    value: parseInt(entry.value, 10),
    classification: entry.value_classification,
    timestamp: parseInt(entry.timestamp, 10) * 1000,
  }
}

/** Fetch global crypto market data from CoinGecko */
export async function fetchCoinGeckoGlobal(): Promise<{
  btcDominance: number | null
  totalMarketCapUsd: number | null
  totalVolumeUsd: number | null
  marketCapChange24h: number | null
}> {
  const res = await fetch('https://api.coingecko.com/api/v3/global')
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
  const json = (await res.json()) as {
    data?: {
      market_cap_percentage?: Record<string, number>
      total_market_cap?: Record<string, number>
      total_volume?: Record<string, number>
      market_cap_change_percentage_24h_usd?: number
    }
  }
  const d = json.data
  return {
    btcDominance: d?.market_cap_percentage?.btc ?? null,
    totalMarketCapUsd: d?.total_market_cap?.usd ?? null,
    totalVolumeUsd: d?.total_volume?.usd ?? null,
    marketCapChange24h: d?.market_cap_change_percentage_24h_usd ?? null,
  }
}

// Binance Futures endpoints are called directly from the browser.
// If Binance blocks CORS, these will silently return null and the UI degrades to "--".
// This is acceptable — the panel is advisory context, not a critical data path.

/** Fetch Binance perpetual funding rate for a tracked coin. Returns null if unsupported. */
export async function fetchBinanceFundingRate(coin: TrackedCoin): Promise<number | null> {
  const symbol = BINANCE_SYMBOL_MAP[coin]
  if (!symbol) return null
  const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
  if (!res.ok) return null
  const json = (await res.json()) as { lastFundingRate?: string }
  const rate = parseFloat(json.lastFundingRate ?? '')
  return isFinite(rate) ? rate : null
}

/** Fetch Binance perpetual open interest for a tracked coin. Returns USD notional or null. */
export async function fetchBinanceOpenInterest(coin: TrackedCoin): Promise<number | null> {
  const symbol = BINANCE_SYMBOL_MAP[coin]
  if (!symbol) return null
  const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
  if (!res.ok) return null
  const json = (await res.json()) as { openInterest?: string }
  const oi = parseFloat(json.openInterest ?? '')
  if (!isFinite(oi)) return null

  // Convert from coin units to USD using mark price — return null if conversion fails
  const priceRes = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
  if (!priceRes.ok) return null
  const priceJson = (await priceRes.json()) as { markPrice?: string }
  const markPrice = parseFloat(priceJson.markPrice ?? '')
  return isFinite(markPrice) ? oi * markPrice : null
}
