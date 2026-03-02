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
import { computeRisk } from '../signals/risk'

const TRACKER_WINDOWS: Record<TrackerWindow, number> = {
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
}

const TRACKER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1000

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

    set((state) => {
      const records = buildTrackedRecords(coin, signals, referencePrice)
      const newRecords = records.filter((record) => shouldTrackRecord(record, state.trackedSignals))

      if (newRecords.length === 0) {
        return {}
      }

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

      return {
        trackedSignals: [...state.trackedSignals, ...newRecords],
        trackedOutcomes: [...state.trackedOutcomes, ...newOutcomes],
      }
    })

    get().pruneTrackerHistory()
  },

  trackDecisionSnapshot: (coin, decision, referencePrice, timestamp = Date.now()) => {
    if (!isFinite(referencePrice) || referencePrice <= 0) {
      return
    }

    set((state) => {
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

      if (!shouldTrackRecord(record, state.trackedSignals)) {
        return {}
      }

      const outcomes = (Object.keys(TRACKER_WINDOWS) as TrackerWindow[]).map((window) => ({
        recordId: record.id,
        window,
        resolvedAt: null,
        futurePrice: null,
        returnPct: null,
        correct: null,
      }))

      return {
        trackedSignals: [...state.trackedSignals, record],
        trackedOutcomes: [...state.trackedOutcomes, ...outcomes],
      }
    })

    get().pruneTrackerHistory()
  },

  trackAllDecisionSnapshots: () => {
    const state = get()
    const riskCoin = state.riskInputs.coin
    const riskSignals = state.signals[riskCoin]
    const atr = riskSignals?.volatility.atr ?? 0
    const riskOutputs = state.riskInputs.entryPrice > 0 ? computeRisk(state.riskInputs, atr) : null
    const globalRiskStatus: RiskStatus = riskOutputs
      ? riskOutputs.tradeGrade === 'green' ? 'safe'
        : riskOutputs.tradeGrade === 'yellow' ? 'borderline'
        : 'danger'
      : 'unknown'

    for (const coin of TRACKED_COINS) {
      const signals = state.signals[coin]
      const price = state.prices[coin]
      if (!signals || signals.isStale || signals.isWarmingUp || !price || !isFinite(price) || price <= 0) {
        continue
      }

      const activeRiskStatus: RiskStatus = coin === riskCoin ? globalRiskStatus : 'unknown'
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

function buildTrackedRecords(
  coin: TrackedCoin,
  signals: AssetSignals,
  referencePrice: number,
): TrackedSignalRecord[] {
  const timestamp = signals.updatedAt

  return [
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'composite',
      direction: signals.composite.direction,
      strength: Math.abs(signals.composite.value),
      label: signals.composite.label,
      referencePrice,
      metadata: {
        agreementCount: signals.composite.agreementCount,
        agreementTotal: signals.composite.agreementTotal,
      },
    }),
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'zScore',
      direction: directionalFromNumber(signals.zScore.normalizedSignal),
      strength: Math.abs(signals.zScore.normalizedSignal),
      label: signals.zScore.label,
      referencePrice,
      metadata: {
        value: signals.zScore.value,
      },
    }),
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'funding',
      direction: directionalFromNumber(signals.funding.normalizedSignal),
      strength: Math.abs(signals.funding.normalizedSignal),
      label: signals.funding.label,
      referencePrice,
      metadata: {
        rate: signals.funding.currentRate,
        zScore: signals.funding.zScore,
      },
    }),
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'oiDelta',
      direction: directionalFromNumber(signals.oiDelta.normalizedSignal),
      strength: Math.abs(signals.oiDelta.normalizedSignal),
      label: signals.oiDelta.label,
      referencePrice,
      metadata: {
        oiChangePct: signals.oiDelta.oiChangePct,
        priceChangePct: signals.oiDelta.priceChangePct,
        confirmation: signals.oiDelta.confirmation,
      },
    }),
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'hurst',
      direction: 'neutral',
      strength: signals.hurst.confidence,
      label: signals.hurst.regime,
      referencePrice,
      metadata: {
        value: signals.hurst.value,
        confidence: signals.hurst.confidence,
      },
    }),
    buildRecord({
      source: 'signal-engine',
      coin,
      timestamp,
      kind: 'entryGeometry',
      direction: signals.entryGeometry.directionBias,
      strength: Math.abs(signals.entryGeometry.stretchZEquivalent) / 3,
      label: signals.entryGeometry.entryQuality,
      referencePrice,
      metadata: {
        stretch: signals.entryGeometry.stretchZEquivalent,
        atrDislocation: signals.entryGeometry.atrDislocation,
      },
    }),
  ]
}

function buildRecord(input: Omit<TrackedSignalRecord, 'id'>): TrackedSignalRecord {
  return {
    ...input,
    id: `${input.coin}-${input.kind}-${input.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
  }
}

function shouldTrackRecord(record: TrackedSignalRecord, existing: TrackedSignalRecord[]): boolean {
  const previous = [...existing].reverse().find((item) => item.coin === record.coin && item.kind === record.kind)
  if (!previous) {
    return true
  }

  if (record.timestamp - previous.timestamp >= DEDUPE_WINDOW_MS) {
    return true
  }

  return (
    previous.direction !== record.direction ||
    previous.label !== record.label ||
    strengthBucket(previous.strength) !== strengthBucket(record.strength)
  )
}

function strengthBucket(value: number): 'low' | 'medium' | 'high' {
  if (value >= 0.66) return 'high'
  if (value >= 0.33) return 'medium'
  return 'low'
}

function resolveFuturePrice(state: AppStore, coin: TrackedCoin, targetTime: number): number | null {
  const matchingCandle = state.candles[coin].find((candle) => candle.time >= targetTime)
  if (matchingCandle) {
    return matchingCandle.close
  }
  return null
}

// Neutral signals (e.g. Hurst regime) are excluded from hit-rate scoring by design.
// They describe market character, not directional bets, so correct/incorrect doesn't apply.
function scoreDirection(direction: TrackedDirection, returnPct: number): boolean | null {
  if (direction === 'neutral') {
    return null
  }
  if (direction === 'long') {
    return returnPct > 0
  }
  return returnPct < 0
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

function directionalFromNumber(value: number): TrackedDirection {
  if (value > 0.1) return 'long'
  if (value < -0.1) return 'short'
  return 'neutral'
}
