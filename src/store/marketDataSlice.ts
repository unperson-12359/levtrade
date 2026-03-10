import type { StateCreator } from 'zustand'
import type { ObservatoryCandleInterval } from '../config/intervals'
import { TRACKED_COINS } from '../types/market'
import type { Candle, TrackedCoin } from '../types/market'
import type { AppStore } from '.'

type CandleStore = Record<TrackedCoin, Record<ObservatoryCandleInterval, Candle[]>>

export interface MarketDataSlice {
  prices: Record<TrackedCoin, number | null>
  candles: CandleStore
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number | null

  setPrices: (mids: Record<string, string>) => void
  setCandles: (coin: TrackedCoin, candles: Candle[], interval?: ObservatoryCandleInterval) => void
  setConnectionStatus: (status: MarketDataSlice['connectionStatus']) => void
}

function initRecord<T>(defaultValue: T): Record<TrackedCoin, T> {
  const result = {} as Record<TrackedCoin, T>
  for (const coin of TRACKED_COINS) {
    result[coin] = defaultValue
  }
  return result
}

function initCandleStore(): CandleStore {
  const result = {} as CandleStore
  for (const coin of TRACKED_COINS) {
    result[coin] = {
      '4h': [],
      '1d': [],
    }
  }
  return result
}

export const createMarketDataSlice: StateCreator<AppStore, [], [], MarketDataSlice> = (set, get) => ({
  prices: initRecord<number | null>(null),
  candles: initCandleStore(),
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

  setCandles: (coin, candles, interval = get().selectedInterval) =>
    set((state) => ({
      candles: {
        ...state.candles,
        [coin]: {
          ...state.candles[coin],
          [interval]: candles,
        },
      },
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
})
