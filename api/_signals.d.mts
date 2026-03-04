// Type declarations for pre-bundled _signals.mjs (generated from src/signals/api-entry.ts)
// Only declares symbols actually used by API functions — not the full barrel.

import type { AssetSignals, RiskStatus } from '../src/types/signals'
import type { TrackedCoin } from '../src/types/market'
import type { SuggestedPositionComposition } from '../src/types/position'
import type { SetupOutcome, SetupWindow, SetupCoverageStatus, SuggestedSetup } from '../src/types/setup'
import type { TrackedSignalRecord, TrackedSignalOutcome, TrackerStats } from '../src/types/tracker'

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
