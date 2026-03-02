import type { StateCreator } from 'zustand'
import { TRACKED_COINS } from '../types/market'
import type { TrackedCoin, Candle, AssetContext, FundingSnapshot, OISnapshot } from '../types/market'
import type { AppStore } from '.'

export interface MarketDataSlice {
  // Data
  prices: Record<TrackedCoin, number | null>
  candles: Record<TrackedCoin, Candle[]>
  extendedCandles: Record<TrackedCoin, Candle[]>
  assetContexts: Record<TrackedCoin, AssetContext | null>
  fundingHistory: Record<TrackedCoin, FundingSnapshot[]>
  oiHistory: Record<TrackedCoin, OISnapshot[]>
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number | null
  errors: string[]

  // Actions
  setPrices: (mids: Record<string, string>) => void
  setCandles: (coin: TrackedCoin, candles: Candle[]) => void
  setExtendedCandles: (coin: TrackedCoin, candles: Candle[]) => void
  appendCandle: (coin: TrackedCoin, candle: Candle) => void
  setAssetContext: (coin: TrackedCoin, ctx: AssetContext) => void
  appendFundingRate: (coin: TrackedCoin, time: number, rate: number) => void
  appendOI: (coin: TrackedCoin, time: number, oi: number) => void
  setConnectionStatus: (status: MarketDataSlice['connectionStatus']) => void
  addError: (error: string) => void
  clearErrors: () => void
}

function initRecord<T>(defaultVal: T): Record<TrackedCoin, T> {
  const result = {} as Record<TrackedCoin, T>
  for (const coin of TRACKED_COINS) {
    result[coin] = defaultVal
  }
  return result
}

const MAX_FUNDING_HISTORY = 200
const MAX_OI_HISTORY = 200
const MS_PER_HOUR = 60 * 60 * 1000

export const createMarketDataSlice: StateCreator<AppStore, [], [], MarketDataSlice> = (set) => ({
  prices: initRecord(null),
  candles: initRecord<Candle[]>([]),
  extendedCandles: initRecord<Candle[]>([]),
  assetContexts: initRecord(null),
  fundingHistory: initRecord<FundingSnapshot[]>([]),
  oiHistory: initRecord<OISnapshot[]>([]),
  connectionStatus: 'disconnected',
  lastUpdate: null,
  errors: [],

  setPrices: (mids) =>
    set((state) => {
      const prices = { ...state.prices }
      for (const coin of TRACKED_COINS) {
        const mid = mids[coin]
        if (mid !== undefined) {
          const val = parseFloat(mid)
          if (isFinite(val)) prices[coin] = val
        }
      }
      return { prices, lastUpdate: Date.now() }
    }),

  setCandles: (coin, candles) =>
    set((state) => ({
      candles: { ...state.candles, [coin]: candles },
    })),

  setExtendedCandles: (coin, candles) =>
    set((state) => ({
      extendedCandles: { ...state.extendedCandles, [coin]: candles },
    })),

  appendCandle: (coin, candle) =>
    set((state) => {
      const existing = state.candles[coin]
      // If same timestamp as last candle, replace it (update current candle)
      if (existing.length > 0 && existing[existing.length - 1]!.time === candle.time) {
        return {
          candles: {
            ...state.candles,
            [coin]: [...existing.slice(0, -1), candle],
          },
        }
      }
      return {
        candles: {
          ...state.candles,
          [coin]: [...existing, candle],
        },
      }
    }),

  setAssetContext: (coin, ctx) =>
    set((state) => ({
      assetContexts: { ...state.assetContexts, [coin]: ctx },
    })),

  appendFundingRate: (coin, time, rate) =>
    set((state) => {
      const existing = state.fundingHistory[coin]
      const last = existing[existing.length - 1]
      const nextEntry = { time, rate }
      const history = last !== undefined && sameHourBucket(last.time, time)
        ? [...existing.slice(0, -1), nextEntry]
        : [...existing, nextEntry]
      // Keep only the last MAX entries
      const trimmed = history.length > MAX_FUNDING_HISTORY
        ? history.slice(-MAX_FUNDING_HISTORY)
        : history
      return {
        fundingHistory: { ...state.fundingHistory, [coin]: trimmed },
      }
    }),

  appendOI: (coin, time, oi) =>
    set((state) => {
      const history = [...state.oiHistory[coin], { time, oi }]
      const trimmed = history.length > MAX_OI_HISTORY
        ? history.slice(-MAX_OI_HISTORY)
        : history
      return {
        oiHistory: { ...state.oiHistory, [coin]: trimmed },
      }
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  addError: (error) =>
    set((state) => ({
      errors: [...state.errors.slice(-9), error], // keep last 10
    })),

  clearErrors: () => set({ errors: [] }),
})

function sameHourBucket(left: number, right: number): boolean {
  return Math.floor(left / MS_PER_HOUR) === Math.floor(right / MS_PER_HOUR)
}
