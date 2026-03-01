import type { StateCreator } from 'zustand'
import { TRACKED_COINS, type TrackedCoin } from '../types/market'
import type { AssetSignals } from '../types/signals'
import type { AppStore } from '.'
import {
  computeATR,
  computeComposite,
  computeDecisionState,
  computeEntryGeometry,
  computeFundingZScore,
  computeHurst,
  computeOIDelta,
  computeRealizedVol,
  computeZScore,
} from '../signals'

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
const STALE_AFTER_MS = 3 * 60 * 1000

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

    // Entry timing geometry
    const entryGeometry = computeEntryGeometry(closes, atr, MIN_CANDLES_ZSCORE)

    // Composite
    const composite = computeComposite(hurst, zScore, funding, oiDelta)

    // Warmup status
    const isWarmingUp = candles.length < MIN_CANDLES_HURST
    const warmupProgress = Math.min(1, candles.length / MIN_CANDLES_HURST)
    const isStale = state.lastUpdate === null
      ? true
      : (Date.now() - state.lastUpdate) > STALE_AFTER_MS

    const decision = computeDecisionState({
      composite,
      entryGeometry,
      hurst,
      isStale,
      isWarmingUp,
    })

    const result: AssetSignals = {
      coin,
      hurst,
      zScore,
      funding,
      oiDelta,
      volatility,
      entryGeometry,
      composite,
      decisionAction: decision.action,
      decisionLabel: decision.label,
      decisionReasons: decision.reasons,
      riskStatus: 'unknown',
      updatedAt: Date.now(),
      isStale,
      isWarmingUp,
      warmupProgress,
    }

    set((state) => ({
      signals: { ...state.signals, [coin]: result },
    }))

    const referencePrice = state.prices[coin] ?? closes[closes.length - 1] ?? 0
    get().trackSignals(coin, result, referencePrice)
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
