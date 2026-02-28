import type { RawCandle, AssetContext, MetaResponse, FundingHistoryEntry } from '../types/market'

const API_URL = 'https://api.hyperliquid.xyz/info'

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
