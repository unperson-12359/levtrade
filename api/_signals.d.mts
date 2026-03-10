// Type declarations for pre-bundled _signals.mjs (generated from src/signals/api-entry.ts)

import type { AssetSignals, RiskStatus } from '../src/types/signals'
import type { Candle, FundingHistoryEntry, OISnapshot, RawCandle, TrackedCoin } from '../src/types/market'
import type { ObservatorySnapshot, IndicatorStateRecord } from '../src/observatory/types'
import type { SuggestedPositionComposition } from '../src/types/position'
import type { SetupOutcome, SetupWindow, SetupCoverageStatus, SuggestedSetup } from '../src/types/setup'

export type { FundingHistoryEntry, OISnapshot, RawCandle, TrackedCoin } from '../src/types/market'
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

export function computeSetupMetrics(
  signals: AssetSignals,
  options?: { confidenceScale?: number; confidenceCap?: number },
): {
  confidence: number
  confidenceTier: SuggestedSetup['confidenceTier']
  timeframe: SuggestedSetup['timeframe']
}

export function computePositionPolicy(
  setup: SuggestedSetup,
  mode: 'validated' | 'provisional',
  accountSize: number,
): {
  leverage: number
  marginUsd: number
  targetRiskPct: number
  capitalFractionCap: number
}

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
  fundingHistory: FundingHistoryEntry[],
  oiHistory: OISnapshot[],
  targetTime: number,
): AssetSignals | null

export function computeSuggestedSetup(
  coin: TrackedCoin,
  signals: AssetSignals,
  currentPrice: number,
  overrides?: Partial<Pick<SuggestedSetup, 'generatedAt' | 'source'>>,
): SuggestedSetup | null

export function computeProvisionalSetup(
  coin: TrackedCoin,
  signals: AssetSignals,
  currentPrice: number,
  overrides?: Partial<Pick<SuggestedSetup, 'generatedAt' | 'source'>>,
): SuggestedSetup | null

export function resolveSetupWindow(
  setup: SuggestedSetup,
  window: SetupWindow,
  candles: Candle[],
  now?: number,
): SetupOutcome | null

export function computeOIDelta(
  history: Array<{ time: number; oi: number }>,
  closes: number[],
): {
  oiChangePct: number
  priceChangePct: number
  confirmation: boolean
  normalizedSignal: number
  label: string
  color: 'green' | 'yellow' | 'red'
  explanation: string
}

export function generateBackfillTimestamps(lastComputedAt: number, now: number, stepMs?: number): number[]

export function buildObservatorySnapshot(input: {
  coin: TrackedCoin
  interval: '4h' | '1d'
  candles: Candle[]
  fundingHistory: Array<{ time: number; rate: number }>
  oiHistory: Array<{ time: number; oi: number }>
}): ObservatorySnapshot

export function buildPersistedObservatoryAnalytics(input: {
  coin: TrackedCoin
  interval: '4h' | '1d'
  days: number
  rows: Array<{
    candleTime: number
    indicatorId: string
    category: ObservatorySnapshot['indicators'][number]['category']
    isOn: boolean
  }>
}): {
  coin: TrackedCoin
  interval: '4h' | '1d'
  days: number
  windowBars: number
  totalHits: number
  lastPersistedBarTime: number | null
  rows: Array<{
    indicatorId: string
    category: ObservatorySnapshot['indicators'][number]['category']
    activeBars: number
    activeRate: number
    currentStreak: number
    maxStreak: number
    lastHitTime: number | null
    recentHitTimes: number[]
  }>
  categoryRows: Array<{
    category: ObservatorySnapshot['indicators'][number]['category']
    totalHits: number
    activeRate: number
  }>
}

export function buildIndicatorStateRecords(snapshot: ObservatorySnapshot): IndicatorStateRecord[]
export function getClosedBarTimes(snapshot: ObservatorySnapshot, now?: number): number[]
export function buildClosedIndicatorStateRecords(
  snapshot: ObservatorySnapshot,
  options?: { now?: number },
): IndicatorStateRecord[]
