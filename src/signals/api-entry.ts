// Barrel export for API function bundling — do not import this from the frontend
export { TRACKED_COINS, parseCandle } from '../types/market'
export type { TrackedCoin, Candle, FundingSnapshot, OISnapshot, RawCandle, FundingHistoryEntry } from '../types/market'
export type { AssetSignals } from '../types/signals'
export type { SuggestedSetup } from '../types/setup'
export { computeHurst } from './hurst'
export { computeZScore } from './zscore'
export { computeFundingZScore } from './funding'
export { computeOIDelta } from './oiDelta'
export { computeATR, computeRealizedVol } from './volatility'
export { computeEntryGeometry } from './entryGeometry'
export { computeComposite } from './composite'
export { computeSuggestedSetup } from './setup'
export { resolveSetupWindow, emptyOutcome, SETUP_WINDOWS } from './resolveOutcome'

// Shared tracker logic for collector
export {
  buildTrackedRecords,
  shouldTrackRecord,
  scoreDirection,
  directionalFromNumber,
  emptySignalOutcome,
  TRACKER_WINDOWS,
} from './trackerLogic'
export { computeTrackerStats, SIGNAL_KIND_LABELS } from './trackerStats'
export type { TrackedSignalRecord, TrackedSignalOutcome, TrackerWindow, TrackedSignalKind } from '../types/tracker'
