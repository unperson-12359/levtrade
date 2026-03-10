export const TRACKED_COINS = ['BTC', 'ETH', 'SOL', 'HYPE'] as const
export type TrackedCoin = (typeof TRACKED_COINS)[number]

// Raw candle from the Hyperliquid candleSnapshot API.
export interface RawCandle {
  t: number
  T: number
  s: string
  i: string
  o: string
  c: string
  h: string
  l: string
  v: string
  n: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
}

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
