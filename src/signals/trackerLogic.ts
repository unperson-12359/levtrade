// Shared pure functions for signal tracking — used by both the client store and the collector.
// Zero React/Zustand dependencies.

import { buildTrackedSignalId, strengthBucket } from '../utils/identity'
import { TRACKER_DEDUPE_WINDOW_MS } from '../config/constants'
import type { TrackedDirection, TrackedSignalOutcome, TrackedSignalRecord, TrackerWindow } from '../types/tracker'
import type { AssetSignals } from '../types/signals'
import type { TrackedCoin } from '../types/market'

export const TRACKER_WINDOWS: Record<TrackerWindow, number> = {
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
}

export function buildTrackedRecords(
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

export function buildRecord(input: Omit<TrackedSignalRecord, 'id'>): TrackedSignalRecord {
  return {
    ...input,
    id: buildTrackedSignalId(input),
  }
}

export function shouldTrackRecord(record: TrackedSignalRecord, existing: TrackedSignalRecord[]): boolean {
  const previous = [...existing].reverse().find((item) => item.coin === record.coin && item.kind === record.kind)
  if (!previous) {
    return true
  }

  if (record.timestamp - previous.timestamp >= TRACKER_DEDUPE_WINDOW_MS) {
    return true
  }

  return (
    previous.direction !== record.direction ||
    previous.label !== record.label ||
    strengthBucket(previous.strength) !== strengthBucket(record.strength)
  )
}

// Neutral signals (e.g. Hurst regime) are excluded from hit-rate scoring by design.
// They describe market character, not directional bets, so correct/incorrect doesn't apply.
export function scoreDirection(direction: TrackedDirection, returnPct: number): boolean | null {
  if (direction === 'neutral') {
    return null
  }
  if (direction === 'long') {
    return returnPct > 0
  }
  return returnPct < 0
}

export function directionalFromNumber(value: number): TrackedDirection {
  if (value > 0.1) return 'long'
  if (value < -0.1) return 'short'
  return 'neutral'
}

export function emptySignalOutcome(window: TrackerWindow): TrackedSignalOutcome {
  return {
    recordId: '',  // will be set by caller
    window,
    resolvedAt: null,
    futurePrice: null,
    returnPct: null,
    correct: null,
  }
}
