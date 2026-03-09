// Type declarations for pre-bundled _signals.mjs (generated from src/signals/api-entry.ts)
// Only declares symbols actually used by API functions — not the full barrel.

import type { AssetSignals, RiskStatus } from '../src/types/signals'
import type { Candle, FundingHistoryEntry, RawCandle, TrackedCoin } from '../src/types/market'
import type { ObservatorySnapshot } from '../src/observatory/types'
import type { SuggestedPositionComposition } from '../src/types/position'
import type { SetupOutcome, SetupWindow, SetupCoverageStatus, SuggestedSetup } from '../src/types/setup'
import type { TrackedSignalRecord, TrackedSignalOutcome, TrackerStats } from '../src/types/tracker'

export type { FundingHistoryEntry, RawCandle, TrackedCoin } from '../src/types/market'
export const TRACKED_COINS: readonly TrackedCoin[]
export function parseCandle(raw: RawCandle): Candle

export function buildSetupId(
  setup: Pick<SuggestedSetup, 'coin' | 'direction' | 'generatedAt' | 'entryPrice' | 'stopPrice' | 'targetPrice'>,
): string

export function emptyOutcome(window: SetupWindow): SetupOutcome
export function summarizeCoverage(
  outcomes: Record<SetupWindow, SetupOutcome>,
  current: SetupCoverageStatus | undefined,
): SetupCoverageStatus

export function computeTrackerStats(
  records: TrackedSignalRecord[],
  outcomes: TrackedSignalOutcome[],
): TrackerStats

export function computeSuggestedPositionComposition(input: {
  coin: TrackedCoin
  accountSize: number
  currentPrice: number | null
  signals: AssetSignals | null
}): SuggestedPositionComposition

export function deriveCompositionRiskStatus(composition: SuggestedPositionComposition): RiskStatus

export function computeSignalsAtTime(
  coin: TrackedCoin,
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number; trades?: number }>,
  fundingHistory: Array<{ time: number; rate?: number; fundingRate?: string }>,
  oiHistory: Array<{ time: number; oi: number }>,
  targetTime: number,
): AssetSignals | null

export function generateBackfillTimestamps(lastComputedAt: number, now: number, stepMs?: number): number[]

export function buildObservatorySnapshot(input: {
  coin: TrackedCoin
  interval: '4h' | '1d'
  candles: Candle[]
  fundingHistory: Array<{ time: number; rate: number }>
  oiHistory: Array<{ time: number; oi: number }>
}): ObservatorySnapshot
