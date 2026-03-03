// Type declarations for pre-bundled _signals.mjs (generated from src/signals/api-entry.ts)
// Only declares symbols actually used by API functions — not the full barrel.

import type { SetupOutcome, SetupWindow, SetupCoverageStatus } from '../src/types/setup'
import type { TrackedSignalRecord, TrackedSignalOutcome } from '../src/types/tracker'

export function emptyOutcome(window: SetupWindow): SetupOutcome
export function summarizeCoverage(
  outcomes: Record<SetupWindow, SetupOutcome>,
  current: SetupCoverageStatus | undefined,
): SetupCoverageStatus

export interface TrackerStats {
  totalSignals: number
  [key: string]: unknown
}

export function computeTrackerStats(
  records: TrackedSignalRecord[],
  outcomes: TrackedSignalOutcome[],
): TrackerStats
