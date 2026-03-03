import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { FearGreedSnapshot, CryptoMacroSnapshot, BinanceContextSnapshot } from '../types/context'
import { TRACKED_COINS } from '../types/market'

function initNullRecord<T>(val: T) {
  const result = {} as Record<(typeof TRACKED_COINS)[number], T>
  for (const coin of TRACKED_COINS) {
    result[coin] = val
  }
  return result
}

export interface ContextSlice {
  fearGreed: FearGreedSnapshot
  cryptoMacro: CryptoMacroSnapshot
  binanceContext: BinanceContextSnapshot
  contextStatus: 'idle' | 'loading' | 'ready' | 'error'
  contextError: string | null

  setFearGreed: (snapshot: FearGreedSnapshot) => void
  setCryptoMacro: (snapshot: CryptoMacroSnapshot) => void
  setBinanceContext: (snapshot: BinanceContextSnapshot) => void
  setContextStatus: (status: ContextSlice['contextStatus']) => void
  setContextError: (error: string | null) => void
}

export const createContextSlice: StateCreator<AppStore, [], [], ContextSlice> = (set) => ({
  fearGreed: {
    value: null,
    classification: null,
    timestamp: null,
    source: 'alternative-me',
  },
  cryptoMacro: {
    btcDominance: null,
    totalMarketCapUsd: null,
    totalVolumeUsd: null,
    marketCapChange24h: null,
    altSeasonBias: 'unknown',
    timestamp: null,
    source: 'coingecko',
  },
  binanceContext: {
    fundingRate: initNullRecord(null),
    openInterestUsd: initNullRecord(null),
    fundingVsHyperliquid: initNullRecord(null),
    oiVsHyperliquid: initNullRecord(null),
    timestamp: null,
    source: 'binance',
  },
  contextStatus: 'idle',
  contextError: null,

  setFearGreed: (snapshot) => set({ fearGreed: snapshot }),
  setCryptoMacro: (snapshot) => set({ cryptoMacro: snapshot }),
  setBinanceContext: (snapshot) => set({ binanceContext: snapshot }),
  setContextStatus: (status) => set({ contextStatus: status }),
  setContextError: (error) => set({ contextError: error }),
})
