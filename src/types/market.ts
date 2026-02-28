export const TRACKED_COINS = ['BTC', 'ETH', 'SOL', 'HYPE'] as const
export type TrackedCoin = (typeof TRACKED_COINS)[number]

/** Raw candle from Hyperliquid candleSnapshot API — all prices are strings */
export interface RawCandle {
  t: number   // open time (ms)
  T: number   // close time (ms)
  s: string   // symbol
  i: string   // interval
  o: string   // open price
  c: string   // close price
  h: string   // high
  l: string   // low
  v: string   // volume
  n: number   // trade count
}

/** Parsed candle with numeric values */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
}

/** Universe entry from metaAndAssetCtxs[0].universe */
export interface AssetMeta {
  name: string
  szDecimals: number
  maxLeverage: number
}

/** Per-asset context from metaAndAssetCtxs[1] */
export interface AssetContext {
  funding: string
  openInterest: string
  markPx: string
  midPx: string
  oraclePx: string
  prevDayPx: string
  dayNtlVlm: string
  premium: string
  impactPxs: [string, string]
}

/** Meta response from metaAndAssetCtxs[0] */
export interface MetaResponse {
  universe: AssetMeta[]
}

/** Funding history entry */
export interface FundingHistoryEntry {
  coin: string
  fundingRate: string
  premium: string
  time: number
}

/** Timestamped funding rate for local storage */
export interface FundingSnapshot {
  time: number
  rate: number
}

/** Timestamped OI for local storage */
export interface OISnapshot {
  time: number
  oi: number
}

/** Parse a RawCandle into a Candle */
export function parseCandle(raw: RawCandle): Candle {
  return {
    time: raw.t,
    open: parseFloat(raw.o),
    high: parseFloat(raw.h),
    low: parseFloat(raw.l),
    close: parseFloat(raw.c),
    volume: parseFloat(raw.v),
    trades: raw.n,
  }
}
