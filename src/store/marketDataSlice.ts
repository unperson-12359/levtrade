import type { StateCreator } from 'zustand'
import { TRACKED_COINS } from '../types/market'
import type { Candle, TrackedCoin } from '../types/market'
import type { AppStore } from '.'

export interface MarketDataSlice {
  prices: Record<TrackedCoin, number | null>
  candles: Record<TrackedCoin, Candle[]>
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number | null

  setPrices: (mids: Record<string, string>) => void
  setCandles: (coin: TrackedCoin, candles: Candle[]) => void
  setConnectionStatus: (status: MarketDataSlice['connectionStatus']) => void
}

function initRecord<T>(defaultValue: T): Record<TrackedCoin, T> {
  const result = {} as Record<TrackedCoin, T>
  for (const coin of TRACKED_COINS) {
    result[coin] = defaultValue
  }
  return result
}

export const createMarketDataSlice: StateCreator<AppStore, [], [], MarketDataSlice> = (set) => ({
  prices: initRecord<number | null>(null),
  candles: initRecord<Candle[]>([]),
  connectionStatus: 'disconnected',
  lastUpdate: null,

  setPrices: (mids) =>
    set((state) => {
      const prices = { ...state.prices }
      for (const coin of TRACKED_COINS) {
        const mid = mids[coin]
        if (mid === undefined) continue
        const numeric = parseFloat(mid)
        if (Number.isFinite(numeric)) {
          prices[coin] = numeric
        }
      }
      return { prices, lastUpdate: Date.now() }
    }),

  setCandles: (coin, candles) =>
    set((state) => ({
      candles: { ...state.candles, [coin]: candles },
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
})
