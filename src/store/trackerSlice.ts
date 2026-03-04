import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { AssetSignals, DecisionAction, RiskStatus } from '../types/signals'
import type {
  TrackedDirection,
  TrackedSignalOutcome,
  TrackedSignalRecord,
  TrackerWindow,
} from '../types/tracker'
import { TRACKED_COINS, type TrackedCoin } from '../types/market'
import { computeDecisionState } from '../signals/decision'
import {
  computeSuggestedPositionComposition,
  deriveCompositionRiskStatus,
} from '../signals/suggestedPosition'
import { TRACKER_RETENTION_MS } from '../config/constants'
import { floorToHour } from '../utils/candleTime'
import {
  buildTrackedRecords,
  buildRecord,
  shouldTrackRecord,
  scoreDirection,
  TRACKER_WINDOWS,
} from '../signals/trackerLogic'

export interface TrackerSlice {
  trackedSignals: TrackedSignalRecord[]
  trackedOutcomes: TrackedSignalOutcome[]
  trackerLastRunAt: number | null

  trackSignals: (coin: TrackedCoin, signals: AssetSignals, referencePrice: number) => void
  trackDecisionSnapshot: (
    coin: TrackedCoin,
    decision: {
      action: DecisionAction
      label: string
      reasons: string[]
      riskStatus: RiskStatus
    },
    referencePrice: number,
    timestamp?: number,
  ) => void
  trackAllDecisionSnapshots: () => void
  resolveTrackedOutcomes: (now?: number) => void
  pruneTrackerHistory: (now?: number) => void
  clearTrackerHistory: () => void
}

export const createTrackerSlice: StateCreator<AppStore, [], [], TrackerSlice> = (set, get) => ({
  trackedSignals: [],
  trackedOutcomes: [],
  trackerLastRunAt: null,

  trackSignals: (coin, signals, referencePrice) => {
    if (!isFinite(referencePrice) || referencePrice <= 0 || signals.isWarmingUp || signals.isStale) {
      return
    }

    // Pre-check dedup BEFORE calling set() to avoid no-op state updates
    const state = get()
    const records = buildTrackedRecords(coin, signals, referencePrice)
    const newRecords = records.filter((record) => shouldTrackRecord(record, state.trackedSignals))
    if (newRecords.length === 0) return

    const newOutcomes = newRecords.flatMap((record) =>
      (Object.keys(TRACKER_WINDOWS) as TrackerWindow[]).map((window) => ({
        recordId: record.id,
        window,
        resolvedAt: null,
        futurePrice: null,
        returnPct: null,
        correct: null,
      })),
    )

    set((s) => ({
      trackedSignals: [...s.trackedSignals, ...newRecords],
      trackedOutcomes: [...s.trackedOutcomes, ...newOutcomes],
    }))
  },

  trackDecisionSnapshot: (coin, decision, referencePrice, timestamp = Date.now()) => {
    if (!isFinite(referencePrice) || referencePrice <= 0) return

    // Pre-check dedup BEFORE calling set() to avoid no-op state updates
    const state = get()
    const record = buildRecord({
      source: 'risk-aware-ui',
      coin,
      timestamp,
      kind: 'decision',
      direction: mapDecisionDirection(decision.action),
      strength: decisionStrength(decision.action, decision.riskStatus),
      label: decision.label,
      referencePrice,
      metadata: {
        reasons: decision.reasons.join(' | '),
        action: decision.action,
        riskStatus: decision.riskStatus,
      },
    })

    if (!shouldTrackRecord(record, state.trackedSignals)) return

    const outcomes = (Object.keys(TRACKER_WINDOWS) as TrackerWindow[]).map((window) => ({
      recordId: record.id,
      window,
      resolvedAt: null,
      futurePrice: null,
      returnPct: null,
      correct: null,
    }))

    set((s) => ({
      trackedSignals: [...s.trackedSignals, record],
      trackedOutcomes: [...s.trackedOutcomes, ...outcomes],
    }))
  },

  trackAllDecisionSnapshots: () => {
    const state = get()
    const selectedCoin = state.selectedCoin
    const selectedComposition = computeSuggestedPositionComposition({
      coin: selectedCoin,
      accountSize: state.riskInputs.accountSize,
      currentPrice: state.prices[selectedCoin],
      signals: state.signals[selectedCoin],
    })
    const selectedRiskStatus = deriveCompositionRiskStatus(selectedComposition)

    for (const coin of TRACKED_COINS) {
      const signals = state.signals[coin]
      const price = state.prices[coin]
      if (!signals || signals.isStale || signals.isWarmingUp || !price || !isFinite(price) || price <= 0) {
        continue
      }

      const activeRiskStatus: RiskStatus = coin === selectedCoin ? selectedRiskStatus : 'unknown'
      const decision = computeDecisionState({
        composite: signals.composite,
        entryGeometry: signals.entryGeometry,
        hurst: signals.hurst,
        isStale: signals.isStale,
        isWarmingUp: signals.isWarmingUp,
        riskStatus: activeRiskStatus,
      })

      get().trackDecisionSnapshot(
        coin,
        {
          action: decision.action,
          label: decision.label,
          reasons: decision.reasons,
          riskStatus: activeRiskStatus,
        },
        price,
        signals.updatedAt,
      )
    }
  },

  resolveTrackedOutcomes: (now = Date.now()) => {
    set((state) => {
      let changed = false
      const resolvedOutcomes = state.trackedOutcomes.map((outcome) => {
        if (outcome.resolvedAt !== null) {
          return outcome
        }

        const record = state.trackedSignals.find((item) => item.id === outcome.recordId)
        if (!record) {
          return outcome
        }

        const targetTime = record.timestamp + TRACKER_WINDOWS[outcome.window]
        if (now < targetTime) {
          return outcome
        }

        const futurePrice = resolveFuturePrice(state, record.coin, targetTime)
        if (futurePrice === null || !isFinite(futurePrice) || futurePrice <= 0) {
          return outcome
        }

        changed = true
        const returnPct = ((futurePrice - record.referencePrice) / record.referencePrice) * 100
        const correct = scoreDirection(record.direction, returnPct)

        return {
          ...outcome,
          resolvedAt: now,
          futurePrice,
          returnPct,
          correct,
        }
      })

      if (!changed) {
        return {
          trackerLastRunAt: now,
        }
      }

      return {
        trackedOutcomes: resolvedOutcomes,
        trackerLastRunAt: now,
      }
    })
  },

  pruneTrackerHistory: (now = Date.now()) => {
    set((state) => {
      const cutoff = now - TRACKER_RETENTION_MS
      const keptSignals = state.trackedSignals.filter((record) => record.timestamp >= cutoff)
      const keptIds = new Set(keptSignals.map((record) => record.id))
      const keptOutcomes = state.trackedOutcomes.filter((outcome) => keptIds.has(outcome.recordId))

      if (
        keptSignals.length === state.trackedSignals.length &&
        keptOutcomes.length === state.trackedOutcomes.length
      ) {
        return {}
      }

      return {
        trackedSignals: keptSignals,
        trackedOutcomes: keptOutcomes,
      }
    })
  },

  clearTrackerHistory: () =>
    set({
      trackedSignals: [],
      trackedOutcomes: [],
      trackerLastRunAt: null,
    }),
})

function resolveFuturePrice(state: AppStore, coin: TrackedCoin, targetTime: number): number | null {
  const bucketTime = floorToHour(targetTime)
  const preferredCandles = state.resolutionCandles[coin].length > 0
    ? state.resolutionCandles[coin]
    : state.candles[coin]

  if (preferredCandles.length === 0) {
    return null
  }

  const exactCandle = preferredCandles.find((candle) => candle.time === bucketTime)
  if (exactCandle) {
    return exactCandle.close
  }

  for (let index = preferredCandles.length - 1; index >= 0; index -= 1) {
    const candle = preferredCandles[index]
    if (candle && candle.time < bucketTime) {
      return candle.close
    }
  }

  const firstAfter = preferredCandles.find((candle) => candle.time > bucketTime)
  if (firstAfter) {
    return firstAfter.close
  }

  return null
}

function mapDecisionDirection(action: DecisionAction): TrackedDirection {
  if (action === 'long' || action === 'short') {
    return action
  }
  return 'neutral'
}

function decisionStrength(action: DecisionAction, riskStatus: RiskStatus): number {
  if (action === 'long' || action === 'short') {
    return riskStatus === 'safe' ? 1 : 0.75
  }
  if (action === 'wait') {
    return 0.5
  }
  return 0.25
}

