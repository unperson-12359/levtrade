import type { StateCreator } from 'zustand'
import { TRACKED_COINS, type TrackedCoin } from '../types/market'
import type { AssetSignals } from '../types/signals'
import type { AppStore } from '.'
import { computeHurst, computeZScore, computeFundingZScore, computeOIDelta, computeATR, computeRealizedVol, computeComposite } from '../signals'

export interface SignalsSlice {
  signals: Record<TrackedCoin, AssetSignals | null>

  computeSignals: (coin: TrackedCoin) => void
  computeAllSignals: () => void
}

function initSignals(): Record<TrackedCoin, AssetSignals | null> {
  const result = {} as Record<TrackedCoin, AssetSignals | null>
  for (const coin of TRACKED_COINS) {
    result[coin] = null
  }
  return result
}

const MIN_CANDLES_HURST = 100
const MIN_CANDLES_ZSCORE = 20

export const createSignalsSlice: StateCreator<AppStore, [], [], SignalsSlice> = (set, get) => ({
  signals: initSignals(),

  computeSignals: (coin) => {
    const state = get()
    const candles = state.candles[coin]
    const fundingHistory = state.fundingHistory[coin]
    const oiHistory = state.oiHistory[coin]

    if (candles.length < 3) return // not enough data

    const closes = candles.map((c) => c.close)

    // Compute all signals
    const hurst = computeHurst(closes, MIN_CANDLES_HURST)
    const zScore = computeZScore(closes, MIN_CANDLES_ZSCORE)
    const funding = computeFundingZScore(fundingHistory)
    const oiDelta = computeOIDelta(oiHistory, closes)

    // Volatility
    const volResult = computeRealizedVol(closes)
    const atr = computeATR(candles)
    const volatility = { ...volResult, atr }

    // Composite
    const composite = computeComposite(hurst, zScore, funding, oiDelta)

    // Warmup status
    const isWarmingUp = candles.length < MIN_CANDLES_HURST
    const warmupProgress = Math.min(1, candles.length / MIN_CANDLES_HURST)

    const result: AssetSignals = {
      coin,
      hurst,
      zScore,
      funding,
      oiDelta,
      volatility,
      composite,
      updatedAt: Date.now(),
      isStale: candles.length > 0 ? (Date.now() - candles[candles.length - 1]!.time) > 5 * 60 * 1000 : false,
      isWarmingUp,
      warmupProgress,
    }

    set((state) => ({
      signals: { ...state.signals, [coin]: result },
    }))
  },

  computeAllSignals: () => {
    const state = get()
    for (const coin of TRACKED_COINS) {
      if (state.candles[coin].length > 0) {
        state.computeSignals(coin)
      }
    }
  },
})
